"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const pg_1 = require("pg");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || 'change-me-change-me';
const jwtExpiresIn = (process.env.JWT_EXPIRES_IN || '15m');
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});
const normalizePhoneNumber = (phoneNumber) => phoneNumber.trim().replace(/\s+/g, '');
const normalizeEmail = (email) => email.trim().toLowerCase();
const normalizeGender = (gender) => {
    const value = (gender || '').trim().toLowerCase();
    if (!value)
        return 'Unknown';
    if (value.startsWith('m'))
        return 'Male';
    if (value.startsWith('f'))
        return 'Female';
    return gender?.trim() || 'Unknown';
};
const toFamilyMemberSummary = (row) => ({
    id: Number(row.id),
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    birthYear: row.birth_year,
    location: row.location,
    gender: row.gender,
    photoUrl: row.photo_url,
    notes: row.notes
});
const ensureFamilyLink = async (sourceUserId, targetUserId, relationshipType) => {
    if (sourceUserId === targetUserId) {
        return;
    }
    await pool.query(`
      INSERT INTO app_family_relationships (source_user_id, target_user_id, relationship_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (source_user_id, target_user_id, relationship_type) DO NOTHING
    `, [sourceUserId, targetUserId, relationshipType]);
};
const getRelatedMembers = async (userId, relationshipType, direction) => {
    const query = direction === 'outgoing'
        ? `
          SELECT u.id, u.full_name, u.phone_number, u.birth_year, u.location, u.gender, u.photo_url, u.notes
          FROM app_family_relationships fr
          JOIN app_users u ON u.id = fr.target_user_id
          WHERE fr.source_user_id = $1 AND fr.relationship_type = $2
          ORDER BY u.full_name ASC
        `
        : `
          SELECT u.id, u.full_name, u.phone_number, u.birth_year, u.location, u.gender, u.photo_url, u.notes
          FROM app_family_relationships fr
          JOIN app_users u ON u.id = fr.source_user_id
          WHERE fr.target_user_id = $1 AND fr.relationship_type = $2
          ORDER BY u.full_name ASC
        `;
    const result = await pool.query(query, [userId, relationshipType]);
    return result.rows.map(toFamilyMemberSummary);
};
const buildFamilySnapshot = async (userId) => {
    const [parents, spouseList, children, siblings] = await Promise.all([
        getRelatedMembers(userId, 'parent', 'incoming'),
        getRelatedMembers(userId, 'spouse', 'outgoing'),
        getRelatedMembers(userId, 'parent', 'outgoing'),
        getRelatedMembers(userId, 'sibling', 'outgoing')
    ]);
    return {
        parents,
        spouse: spouseList[0] || null,
        children,
        siblings
    };
};
const getTableRegclass = async (tableName) => {
    const result = await pool.query('SELECT to_regclass($1) AS table_ref', [tableName]);
    return result.rows[0]?.table_ref || null;
};
const queryCount = async (query) => {
    try {
        const result = await pool.query(query);
        return Number(result.rows[0]?.count ?? 0);
    }
    catch (error) {
        if (typeof error === 'object' && error && 'code' in error && error.code === '42P01') {
            return 0;
        }
        throw error;
    }
};
const signToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, jwtSecret, {
        expiresIn: jwtExpiresIn
    });
};
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        res.status(401).json({ success: false, message: 'Missing access token.' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        req.user = {
            id: decoded.id,
            email: decoded.email,
            fullName: decoded.fullName,
            role: decoded.role || 'MEMBER'
        };
        next();
    }
    catch {
        res.status(401).json({ success: false, message: 'Invalid or expired access token.' });
    }
};
const initializeDatabase = async () => {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(120) NOT NULL,
      email VARCHAR(160),
      phone_number VARCHAR(30),
      role VARCHAR(30) NOT NULL DEFAULT 'MEMBER',
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
    await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email VARCHAR(160)');
    await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30)');
    await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS birth_year INT');
    await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS location VARCHAR(120)');
    await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS gender VARCHAR(30)');
    await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS photo_url TEXT');
    await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS notes TEXT');
    await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_by INT');
    await pool.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role VARCHAR(30) NOT NULL DEFAULT 'MEMBER'");
    await pool.query('ALTER TABLE app_users ALTER COLUMN phone_number DROP NOT NULL');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_unique_idx ON app_users (LOWER(email)) WHERE email IS NOT NULL');
    await pool.query(`
    CREATE TABLE IF NOT EXISTS app_family_relationships (
      id SERIAL PRIMARY KEY,
      source_user_id INT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      target_user_id INT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      relationship_type VARCHAR(20) NOT NULL CHECK (relationship_type IN ('spouse', 'parent', 'child', 'sibling')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(source_user_id, target_user_id, relationship_type)
    )
  `);
};
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.post('/api/auth/signup', async (req, res) => {
    const firstName = typeof req.body.firstName === 'string' ? req.body.firstName.trim() : '';
    const surnameInput = typeof req.body.lastName === 'string' ? req.body.lastName : req.body.surname;
    const lastName = typeof surnameInput === 'string' ? surnameInput.trim() : '';
    const fullName = `${firstName} ${lastName}`.trim();
    const password = typeof req.body.password === 'string' ? req.body.password.trim() : '';
    const email = typeof req.body.email === 'string' ? normalizeEmail(req.body.email) : '';
    if (!firstName || !lastName || !email || !password) {
        res.status(400).json({ success: false, message: 'firstName, lastName (or surname), email and password are required.' });
        return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
        return;
    }
    if (password.length < 6) {
        res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        return;
    }
    try {
        const existing = await pool.query('SELECT id FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
        if (existing.rowCount) {
            res.status(409).json({ success: false, message: 'Account already exists with this email.' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const created = await pool.query(`
      INSERT INTO app_users (full_name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, full_name, email, phone_number, role
      `, [fullName, email, passwordHash]);
        const user = created.rows[0];
        const token = signToken({ id: user.id, fullName: user.full_name, email: user.email, role: user.role });
        res.status(201).json({
            success: true,
            message: 'Account created successfully.',
            token,
            user: {
                id: user.id,
                fullName: user.full_name,
                email: user.email,
                phoneNumber: user.phone_number,
                role: user.role
            }
        });
    }
    catch (error) {
        console.error('Signup error', error);
        res.status(500).json({ success: false, message: 'Failed to create account.' });
    }
});
app.put('/api/auth/profile', authenticate, async (req, res) => {
    const userId = req.user?.id;
    const fullName = typeof req.body.fullName === 'string' ? req.body.fullName.trim() : undefined;
    const phoneNumberRaw = typeof req.body.phoneNumber === 'string' ? req.body.phoneNumber : undefined;
    const phoneNumber = phoneNumberRaw === undefined ? undefined : normalizePhoneNumber(phoneNumberRaw);
    if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
    }
    if (fullName === undefined && phoneNumber === undefined) {
        res.status(400).json({ success: false, message: 'Provide at least one profile field to update.' });
        return;
    }
    const updates = [];
    const params = [];
    if (fullName !== undefined) {
        if (!fullName) {
            res.status(400).json({ success: false, message: 'Full name cannot be empty.' });
            return;
        }
        params.push(fullName);
        updates.push(`full_name = $${params.length}`);
    }
    if (phoneNumber !== undefined) {
        params.push(phoneNumber || null);
        updates.push(`phone_number = $${params.length}`);
    }
    params.push(userId);
    try {
        const result = await pool.query(`UPDATE app_users SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, full_name, email, phone_number, role`, params);
        if (!result.rowCount) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const user = result.rows[0];
        res.json({
            success: true,
            message: 'Profile updated successfully.',
            user: {
                id: user.id,
                fullName: user.full_name,
                email: user.email,
                phoneNumber: user.phone_number,
                role: user.role
            }
        });
    }
    catch (error) {
        if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
            res.status(409).json({ success: false, message: 'This phone number is already used by another account.' });
            return;
        }
        console.error('Profile update error', error);
        res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }
});
app.post('/api/auth/login', async (req, res) => {
    const email = typeof req.body.email === 'string' ? normalizeEmail(req.body.email) : '';
    const password = typeof req.body.password === 'string' ? req.body.password.trim() : '';
    if (!email || !password) {
        res.status(400).json({ success: false, message: 'email and password are required.' });
        return;
    }
    try {
        const result = await pool.query('SELECT id, full_name, email, phone_number, role, password_hash FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
        if (!result.rowCount) {
            res.status(401).json({ success: false, message: 'Invalid email or password.' });
            return;
        }
        const user = result.rows[0];
        const matches = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!matches) {
            res.status(401).json({ success: false, message: 'Invalid email or password.' });
            return;
        }
        const token = signToken({ id: user.id, fullName: user.full_name, email: user.email, role: user.role });
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                fullName: user.full_name,
                email: user.email,
                phoneNumber: user.phone_number,
                role: user.role
            }
        });
    }
    catch (error) {
        console.error('Login error', error);
        res.status(500).json({ success: false, message: 'Failed to login.' });
    }
});
app.get('/api/auth/me', authenticate, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
    }
    try {
        const result = await pool.query('SELECT id, full_name, email, phone_number, role FROM app_users WHERE id = $1 LIMIT 1', [userId]);
        if (!result.rowCount) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const user = result.rows[0];
        res.json({
            success: true,
            user: {
                id: user.id,
                fullName: user.full_name,
                email: user.email,
                phoneNumber: user.phone_number,
                role: user.role
            }
        });
    }
    catch (error) {
        console.error('Profile fetch error', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user profile.' });
    }
});
app.get('/api/mobile/dashboard', authenticate, async (_req, res) => {
    try {
        const memberTable = (await getTableRegclass('"Member"')) ? '"Member"' : 'app_users';
        const contributionTable = (await getTableRegclass('"Contribution"')) ? '"Contribution"' : null;
        const funeralCaseTable = (await getTableRegclass('"FuneralCase"')) ? '"FuneralCase"' : null;
        const notificationTable = (await getTableRegclass('"Notification"')) ? '"Notification"' : null;
        let membersCount = 0;
        let householdsCount = 0;
        let activeCasesCount = 0;
        let completionRate = 0;
        let directoryCompletionRate = 0;
        let directoryMembers = [];
        let notifications = [];
        let upcomingMoments = [];
        let funeralCases = [];
        try {
            membersCount = await queryCount(memberTable === '"Member"' ? 'SELECT COUNT(*)::int AS count FROM "Member"' : 'SELECT COUNT(*)::int AS count FROM app_users');
            householdsCount = await queryCount(memberTable === '"Member"'
                ? `SELECT COUNT(DISTINCT LOWER(REGEXP_REPLACE(TRIM("fullName"), '^.*\\s', '')))::int AS count FROM "Member" WHERE TRIM("fullName") <> ''`
                : `SELECT COUNT(DISTINCT LOWER(REGEXP_REPLACE(TRIM(full_name), '^.*\\s', '')))::int AS count FROM app_users WHERE TRIM(full_name) <> ''`);
            const directoryRows = memberTable === '"Member"'
                ? await pool.query('SELECT "fullName" AS full_name FROM "Member" ORDER BY "fullName" ASC LIMIT 200')
                : await pool.query('SELECT full_name FROM app_users ORDER BY full_name ASC LIMIT 200');
            directoryMembers = directoryRows.rows.map((row) => row.full_name?.trim() || '').filter(Boolean);
            const directoryCompletionResult = memberTable === '"Member"'
                ? await pool.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "phoneNumber" IS NOT NULL AND TRIM("phoneNumber") <> \'\')::int AS complete FROM "Member"')
                : await pool.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE phone_number IS NOT NULL AND TRIM(phone_number) <> \'\')::int AS complete FROM app_users');
            const directoryTotal = Number(directoryCompletionResult.rows[0]?.total ?? 0);
            const directoryComplete = Number(directoryCompletionResult.rows[0]?.complete ?? 0);
            directoryCompletionRate = directoryTotal ? (directoryComplete / directoryTotal) * 100 : 0;
        }
        catch (error) {
            console.warn('Mobile dashboard member section fallback', error);
        }
        if (contributionTable) {
            try {
                const completionResult = await pool.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = \'PAID\')::int AS paid FROM "Contribution"');
                const total = Number(completionResult.rows[0]?.total ?? 0);
                const paid = Number(completionResult.rows[0]?.paid ?? 0);
                completionRate = total ? (paid / total) * 100 : 0;
            }
            catch (error) {
                console.warn('Mobile dashboard contribution section fallback', error);
            }
        }
        if (funeralCaseTable) {
            try {
                activeCasesCount = await queryCount('SELECT COUNT(*)::int AS count FROM "FuneralCase" WHERE "isActive" = true');
                upcomingMoments = (await pool.query('SELECT id, "funeralDate", "funeralLocation" FROM "FuneralCase" WHERE "funeralDate" >= NOW() ORDER BY "funeralDate" ASC LIMIT 5')).rows.map((row) => ({
                    id: row.id,
                    title: 'Upcoming Funeral Support',
                    detail: `${new Date(row.funeralDate).toLocaleDateString()} • ${row.funeralLocation}`
                }));
                funeralCases = (await pool.query('SELECT id, "funeralDate", "funeralLocation", "contributionPerMember", "isActive" FROM "FuneralCase" ORDER BY "funeralDate" DESC LIMIT 20')).rows.map((row) => ({
                    id: row.id,
                    funeralDate: new Date(row.funeralDate).toISOString(),
                    funeralLocation: row.funeralLocation,
                    contributionPerMember: Number(row.contributionPerMember || 0),
                    isActive: Boolean(row.isActive)
                }));
            }
            catch (error) {
                console.warn('Mobile dashboard funeral section fallback', error);
            }
        }
        if (notificationTable) {
            try {
                notifications = (await pool.query('SELECT id, title, message, "createdAt" FROM "Notification" ORDER BY "createdAt" DESC LIMIT 8')).rows.map((row) => ({
                    id: row.id,
                    title: row.title,
                    message: row.message,
                    createdAt: new Date(row.createdAt).toISOString()
                }));
            }
            catch (error) {
                console.warn('Mobile dashboard notification section fallback', error);
            }
        }
        res.json({
            success: true,
            dashboard: {
                stats: {
                    membersCount,
                    householdsCount,
                    activeCasesCount,
                    completionRate,
                    directoryCompletionRate
                },
                directoryMembers,
                notifications,
                upcomingMoments,
                funeralCases
            }
        });
    }
    catch (error) {
        console.error('Mobile dashboard fetch error', error);
        res.status(500).json({ success: false, message: 'Failed to load mobile dashboard data.' });
    }
});
app.get('/api/mobile/family', authenticate, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
    }
    try {
        const family = await buildFamilySnapshot(userId);
        res.json({ success: true, family });
    }
    catch (error) {
        console.error('Mobile family fetch error', error);
        res.status(500).json({ success: false, message: 'Failed to load family connections.' });
    }
});
app.get('/api/mobile/family/suggestions', authenticate, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
    }
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    const fullName = typeof req.query.fullName === 'string' ? req.query.fullName.trim() : '';
    const phoneNumberRaw = typeof req.query.phoneNumber === 'string' ? req.query.phoneNumber : '';
    const phoneNumber = phoneNumberRaw ? normalizePhoneNumber(phoneNumberRaw) : '';
    const birthYear = typeof req.query.birthYear === 'string' ? Number(req.query.birthYear) : undefined;
    if (!query && !fullName && !phoneNumber && !birthYear) {
        res.status(400).json({ success: false, message: 'Provide query, fullName, phoneNumber or birthYear.' });
        return;
    }
    try {
        const params = [userId];
        const conditions = [];
        if (query) {
            params.push(`%${query}%`);
            const pos = params.length;
            conditions.push(`(full_name ILIKE $${pos} OR COALESCE(location, '') ILIKE $${pos} OR COALESCE(phone_number, '') ILIKE $${pos})`);
        }
        if (fullName) {
            params.push(fullName);
            conditions.push(`LOWER(full_name) = LOWER($${params.length})`);
        }
        if (phoneNumber) {
            params.push(phoneNumber);
            conditions.push(`phone_number = $${params.length}`);
        }
        if (birthYear && Number.isFinite(birthYear)) {
            params.push(Number(birthYear));
            conditions.push(`birth_year = $${params.length}`);
        }
        const sql = `
      SELECT id, full_name, phone_number, birth_year, location, gender, photo_url, notes
      FROM app_users
      WHERE id <> $1
      ${conditions.length ? `AND (${conditions.join(' OR ')})` : ''}
      ORDER BY full_name ASC
      LIMIT 10
    `;
        const result = await pool.query(sql, params);
        res.json({ success: true, suggestions: result.rows.map(toFamilyMemberSummary) });
    }
    catch (error) {
        console.error('Mobile family suggestion error', error);
        res.status(500).json({ success: false, message: 'Failed to search family members.' });
    }
});
app.post('/api/mobile/family/link', authenticate, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
    }
    const relationshipType = req.body.relationshipType === 'spouse' ||
        req.body.relationshipType === 'child' ||
        req.body.relationshipType === 'parent' ||
        req.body.relationshipType === 'sibling'
        ? req.body.relationshipType
        : null;
    if (!relationshipType) {
        res.status(400).json({ success: false, message: 'relationshipType must be spouse, child, parent, or sibling.' });
        return;
    }
    const targetUserIdInput = req.body.targetUserId;
    let targetUserId = typeof targetUserIdInput === 'number' ? targetUserIdInput : Number(targetUserIdInput);
    const memberPayload = typeof req.body.member === 'object' && req.body.member ? req.body.member : null;
    const forceCreate = Boolean(req.body.forceCreate);
    try {
        if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
            if (!memberPayload) {
                res.status(400).json({ success: false, message: 'Provide targetUserId or member payload.' });
                return;
            }
            const fullName = typeof memberPayload.fullName === 'string' ? memberPayload.fullName.trim() : '';
            const phoneNumberRaw = typeof memberPayload.phoneNumber === 'string' ? memberPayload.phoneNumber : '';
            const phoneNumber = phoneNumberRaw ? normalizePhoneNumber(phoneNumberRaw) : null;
            const birthYearRaw = memberPayload.birthYear;
            const birthYear = typeof birthYearRaw === 'number' ? birthYearRaw : Number(birthYearRaw);
            const location = typeof memberPayload.location === 'string' ? memberPayload.location.trim() : null;
            const gender = normalizeGender(typeof memberPayload.gender === 'string' ? memberPayload.gender : undefined);
            const notes = typeof memberPayload.notes === 'string' ? memberPayload.notes.trim() : null;
            const photoUrlInput = typeof memberPayload.photoUrl === 'string' ? memberPayload.photoUrl.trim() : '';
            const photoUrl = photoUrlInput || null;
            const emailInput = typeof memberPayload.email === 'string' ? memberPayload.email.trim() : '';
            const normalizedEmailInput = emailInput ? normalizeEmail(emailInput) : '';
            if (!fullName) {
                res.status(400).json({ success: false, message: 'member.fullName is required.' });
                return;
            }
            const duplicateParams = [userId];
            const duplicateConditions = [];
            duplicateParams.push(fullName);
            duplicateConditions.push(`LOWER(full_name) = LOWER($${duplicateParams.length})`);
            if (phoneNumber) {
                duplicateParams.push(phoneNumber);
                duplicateConditions.push(`phone_number = $${duplicateParams.length}`);
            }
            if (Number.isFinite(birthYear)) {
                duplicateParams.push(Number(birthYear));
                duplicateConditions.push(`birth_year = $${duplicateParams.length}`);
            }
            const duplicateResult = await pool.query(`
          SELECT id, full_name, phone_number, birth_year, location, gender, photo_url, notes
          FROM app_users
          WHERE id <> $1
            AND (${duplicateConditions.join(' OR ')})
          ORDER BY full_name ASC
          LIMIT 8
        `, duplicateParams);
            if (duplicateResult.rowCount && !forceCreate) {
                res.status(409).json({
                    success: false,
                    message: 'This person may already exist. Link an existing profile or retry with forceCreate=true.',
                    suggestions: duplicateResult.rows.map(toFamilyMemberSummary)
                });
                return;
            }
            let emailToUse = `family+${Date.now()}${Math.floor(Math.random() * 1000)}@ubuntu-roots.local`;
            if (normalizedEmailInput) {
                if (!/^\S+@\S+\.\S+$/.test(normalizedEmailInput)) {
                    res.status(400).json({ success: false, message: 'Please enter a valid email address for the family member.' });
                    return;
                }
                const existingEmail = await pool.query('SELECT id FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1', [normalizedEmailInput]);
                if (existingEmail.rowCount) {
                    res.status(409).json({ success: false, message: 'This email is already used by another member.' });
                    return;
                }
                emailToUse = normalizedEmailInput;
            }
            const placeholderHash = await bcryptjs_1.default.hash(`family-link-${Date.now()}`, 10);
            const created = await pool.query(`
          INSERT INTO app_users (full_name, email, phone_number, birth_year, location, gender, photo_url, notes, role, password_hash, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'MEMBER', $9, $10)
          RETURNING id
        `, [
                fullName,
                emailToUse,
                phoneNumber,
                Number.isFinite(birthYear) ? Number(birthYear) : null,
                location,
                gender,
                photoUrl,
                notes,
                placeholderHash,
                userId
            ]);
            targetUserId = Number(created.rows[0]?.id);
        }
        if (!Number.isFinite(targetUserId) || targetUserId <= 0 || targetUserId === userId) {
            res.status(400).json({ success: false, message: 'Invalid target member selection.' });
            return;
        }
        const targetExists = await pool.query('SELECT id FROM app_users WHERE id = $1 LIMIT 1', [targetUserId]);
        if (!targetExists.rowCount) {
            res.status(404).json({ success: false, message: 'Target member not found.' });
            return;
        }
        if (relationshipType === 'spouse') {
            await ensureFamilyLink(userId, targetUserId, 'spouse');
            await ensureFamilyLink(targetUserId, userId, 'spouse');
        }
        if (relationshipType === 'parent') {
            await ensureFamilyLink(targetUserId, userId, 'parent');
            await ensureFamilyLink(userId, targetUserId, 'child');
        }
        if (relationshipType === 'child') {
            await ensureFamilyLink(userId, targetUserId, 'parent');
            await ensureFamilyLink(targetUserId, userId, 'child');
            const spouseRows = await pool.query('SELECT target_user_id FROM app_family_relationships WHERE source_user_id = $1 AND relationship_type = $2 LIMIT 1', [userId, 'spouse']);
            const spouseId = Number(spouseRows.rows[0]?.target_user_id || 0);
            if (spouseId) {
                await ensureFamilyLink(spouseId, targetUserId, 'parent');
                await ensureFamilyLink(targetUserId, spouseId, 'child');
            }
        }
        if (relationshipType === 'sibling') {
            await ensureFamilyLink(userId, targetUserId, 'sibling');
            await ensureFamilyLink(targetUserId, userId, 'sibling');
            const sourceParents = await pool.query('SELECT source_user_id FROM app_family_relationships WHERE target_user_id = $1 AND relationship_type = $2', [userId, 'parent']);
            const targetParents = await pool.query('SELECT source_user_id FROM app_family_relationships WHERE target_user_id = $1 AND relationship_type = $2', [targetUserId, 'parent']);
            const sourceParentIds = sourceParents.rows.map((row) => Number(row.source_user_id));
            const targetParentIds = targetParents.rows.map((row) => Number(row.source_user_id));
            if (sourceParentIds.length) {
                for (const parentId of sourceParentIds) {
                    await ensureFamilyLink(parentId, targetUserId, 'parent');
                    await ensureFamilyLink(targetUserId, parentId, 'child');
                }
            }
            if (targetParentIds.length) {
                for (const parentId of targetParentIds) {
                    await ensureFamilyLink(parentId, userId, 'parent');
                    await ensureFamilyLink(userId, parentId, 'child');
                }
            }
        }
        const family = await buildFamilySnapshot(userId);
        res.json({ success: true, message: 'Family member linked successfully.', family });
    }
    catch (error) {
        console.error('Mobile family link error', error);
        res.status(500).json({ success: false, message: 'Failed to link family member.' });
    }
});
app.get('/health', (_req, res) => {
    res.json({
        success: true,
        service: 'ubuntu-roots-backend',
        status: 'ok'
    });
});
app.get('/api/info', (_req, res) => {
    res.json({
        success: true,
        message: 'Ubuntu Roots backend service is running'
    });
});
initializeDatabase()
    .then(() => {
    app.listen(port, () => {
        console.info(`Ubuntu Roots backend listening on http://localhost:${port}`);
    });
})
    .catch((error) => {
    console.error('Failed to initialize database', error);
    process.exit(1);
});
