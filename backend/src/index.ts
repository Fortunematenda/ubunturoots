import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || 'change-me-change-me';
const jwtExpiresIn = (process.env.JWT_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

type AuthRequest = Request & {
  user?: {
    id: number;
    email: string;
    fullName: string;
    role: string;
  };
};

const normalizePhoneNumber = (phoneNumber: string): string => phoneNumber.trim().replace(/\s+/g, '');
const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const normalizeGender = (gender?: string) => {
  const value = (gender || '').trim().toLowerCase();
  if (!value) return 'Unknown';
  if (value.startsWith('m')) return 'Male';
  if (value.startsWith('f')) return 'Female';
  return gender?.trim() || 'Unknown';
};

type FamilyRelationType = 'spouse' | 'parent' | 'child' | 'sibling';

type FamilyMemberSummary = {
  id: number;
  fullName: string;
  phoneNumber: string | null;
  birthYear: number | null;
  deathDate?: string | null;
  location: string | null;
  gender: string | null;
  photoUrl: string | null;
  notes: string | null;
  clanName?: string | null;
  totem?: string | null;
  tribe?: string | null;
  originCountry?: string | null;
};

const toFamilyMemberSummary = (row: {
  id: number;
  full_name: string;
  phone_number: string | null;
  birth_year: number | null;
  death_date?: string | Date | null;
  location: string | null;
  gender: string | null;
  photo_url: string | null;
  notes: string | null;
  clan_name?: string | null;
  totem?: string | null;
  tribe?: string | null;
  origin_country?: string | null;
}): FamilyMemberSummary => ({
  id: Number(row.id),
  fullName: row.full_name,
  phoneNumber: row.phone_number,
  birthYear: row.birth_year,
  deathDate: row.death_date ? new Date(row.death_date).toISOString() : null,
  location: row.location,
  gender: row.gender,
  photoUrl: row.photo_url,
  notes: row.notes,
  clanName: row.clan_name ?? null,
  totem: row.totem ?? null,
  tribe: row.tribe ?? null,
  originCountry: row.origin_country ?? null
});

type FamilyMemoryType = 'PHOTO' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';

type FamilyMemorySummary = {
  id: number;
  memberId: number;
  title: string;
  description: string | null;
  fileUrl: string;
  type: FamilyMemoryType;
  createdByUserId: number;
  createdAt: string;
};

const ensureFamilyLink = async (sourceUserId: number, targetUserId: number, relationshipType: FamilyRelationType) => {
  if (sourceUserId === targetUserId) {
    return;
  }

  await pool.query(
    `
      INSERT INTO app_family_relationships (source_user_id, target_user_id, relationship_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (source_user_id, target_user_id, relationship_type) DO NOTHING
    `,
    [sourceUserId, targetUserId, relationshipType]
  );
};

const getRelatedMembers = async (userId: number, relationshipType: FamilyRelationType, direction: 'outgoing' | 'incoming') => {
  const query =
    direction === 'outgoing'
      ? `
          SELECT u.id, u.full_name, u.phone_number, u.birth_year, u.death_date, u.location, u.gender, u.photo_url, u.notes,
                 u.clan_name, u.totem, u.tribe, u.origin_country
          FROM app_family_relationships fr
          JOIN app_users u ON u.id = fr.target_user_id
          WHERE fr.source_user_id = $1 AND fr.relationship_type = $2
          ORDER BY u.full_name ASC
        `
      : `
          SELECT u.id, u.full_name, u.phone_number, u.birth_year, u.death_date, u.location, u.gender, u.photo_url, u.notes,
                 u.clan_name, u.totem, u.tribe, u.origin_country
          FROM app_family_relationships fr
          JOIN app_users u ON u.id = fr.source_user_id
          WHERE fr.target_user_id = $1 AND fr.relationship_type = $2
          ORDER BY u.full_name ASC
        `;

  const result = await pool.query(query, [userId, relationshipType]);
  return result.rows.map(toFamilyMemberSummary);
};

const buildFamilySnapshot = async (userId: number) => {
  const [ownParents, spouseList, children, siblings] = await Promise.all([
    getRelatedMembers(userId, 'parent', 'incoming'),
    getRelatedMembers(userId, 'spouse', 'outgoing'),
    getRelatedMembers(userId, 'parent', 'outgoing'),
    getRelatedMembers(userId, 'sibling', 'outgoing')
  ]);

  const spouse = spouseList[0] || null;
  const spouseParents = spouse ? await getRelatedMembers(spouse.id, 'parent', 'incoming') : [];

  return {
    parents: ownParents,
    ownParents,
    spouseParents,
    spouse,
    children,
    siblings
  };
};

const getTableRegclass = async (tableName: string): Promise<string | null> => {
  const result = await pool.query('SELECT to_regclass($1) AS table_ref', [tableName]);
  return (result.rows[0]?.table_ref as string | null) || null;
};

const queryCount = async (query: string): Promise<number> => {
  try {
    const result = await pool.query(query);
    return Number(result.rows[0]?.count ?? 0);
  } catch (error: unknown) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '42P01') {
      return 0;
    }

    throw error;
  }
};

const signToken = (payload: { id: number; email: string; fullName: string; role: string }): string => {
  return jwt.sign(payload, jwtSecret, {
    expiresIn: jwtExpiresIn
  });
};

const authenticate = (req: AuthRequest, res: Response, next: () => void) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ success: false, message: 'Missing access token.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: number; email: string; fullName: string; role?: string };
    req.user = {
      id: decoded.id,
      email: decoded.email,
      fullName: decoded.fullName,
      role: decoded.role || 'MEMBER'
    };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired access token.' });
  }
};

const initializeDatabase = async (): Promise<void> => {
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
  await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS death_date TIMESTAMPTZ');
  await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_by INT');
  await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS clan_name VARCHAR(140)');
  await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS totem VARCHAR(140)');
  await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS tribe VARCHAR(140)');
  await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS origin_country VARCHAR(140)');
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_family_memories (
      id SERIAL PRIMARY KEY,
      member_id INT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      title VARCHAR(160) NOT NULL,
      description TEXT,
      file_url TEXT NOT NULL,
      type VARCHAR(20) NOT NULL CHECK (type IN ('PHOTO', 'AUDIO', 'VIDEO', 'DOCUMENT')),
      created_by_user_id INT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS app_family_memories_member_id_idx ON app_family_memories (member_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS app_family_memories_created_at_idx ON app_family_memories (created_at DESC)');
};

const canEditMember = (requestingUserId: number, requestingRole: string | undefined, targetMemberId: number) => {
  if (requestingUserId === targetMemberId) {
    return true;
  }

  const role = (requestingRole || '').toUpperCase();
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
};

app.use(cors());
app.use(express.json());

app.post('/api/auth/signup', async (req: Request, res: Response) => {
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

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await pool.query(
      `
      INSERT INTO app_users (full_name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, full_name, email, phone_number, role
      `,
      [fullName, email, passwordHash]
    );

    const user = created.rows[0] as {
      id: number;
      full_name: string;
      email: string;
      phone_number: string | null;
      role: string;
    };
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
  } catch (error) {
    console.error('Signup error', error);
    res.status(500).json({ success: false, message: 'Failed to create account.' });
  }
});

app.put('/api/auth/profile', authenticate, async (req: AuthRequest, res: Response) => {
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

  const updates: string[] = [];
  const params: Array<string | number | null> = [];

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
    const result = await pool.query(
      `UPDATE app_users SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, full_name, email, phone_number, role`,
      params
    );

    if (!result.rowCount) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const user = result.rows[0] as { id: number; full_name: string; email: string; phone_number: string | null; role: string };
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
  } catch (error: unknown) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      res.status(409).json({ success: false, message: 'This phone number is already used by another account.' });
      return;
    }

    console.error('Profile update error', error);
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const email = typeof req.body.email === 'string' ? normalizeEmail(req.body.email) : '';
  const password = typeof req.body.password === 'string' ? req.body.password.trim() : '';

  if (!email || !password) {
    res.status(400).json({ success: false, message: 'email and password are required.' });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT id, full_name, email, phone_number, role, password_hash FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email]
    );

    if (!result.rowCount) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const user = result.rows[0] as {
      id: number;
      full_name: string;
      email: string;
      phone_number: string | null;
      role: string;
      password_hash: string;
    };

    const matches = await bcrypt.compare(password, user.password_hash);

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
  } catch (error) {
    console.error('Login error', error);
    res.status(500).json({ success: false, message: 'Failed to login.' });
  }
});

app.get('/api/auth/me', authenticate, async (req: AuthRequest, res: Response) => {
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

    const user = result.rows[0] as { id: number; full_name: string; email: string; phone_number: string | null; role: string };
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
  } catch (error) {
    console.error('Profile fetch error', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user profile.' });
  }
});

app.get('/api/mobile/dashboard', authenticate, async (_req: AuthRequest, res: Response) => {
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
    let directoryMembers: string[] = [];
    let notifications: Array<{ id: string; title: string; message: string; createdAt: string }> = [];
    let upcomingMoments: Array<{ id: string; title: string; detail: string }> = [];
    let funeralCases: Array<{
      id: string;
      funeralDate: string;
      funeralLocation: string;
      contributionPerMember: number;
      isActive: boolean;
    }> = [];

    try {
      membersCount = await queryCount(
        memberTable === '"Member"' ? 'SELECT COUNT(*)::int AS count FROM "Member"' : 'SELECT COUNT(*)::int AS count FROM app_users'
      );
      householdsCount = await queryCount(
        memberTable === '"Member"'
          ? `SELECT COUNT(DISTINCT LOWER(REGEXP_REPLACE(TRIM("fullName"), '^.*\\s', '')))::int AS count FROM "Member" WHERE TRIM("fullName") <> ''`
          : `SELECT COUNT(DISTINCT LOWER(REGEXP_REPLACE(TRIM(full_name), '^.*\\s', '')))::int AS count FROM app_users WHERE TRIM(full_name) <> ''`
      );

      const directoryRows =
        memberTable === '"Member"'
          ? await pool.query('SELECT "fullName" AS full_name FROM "Member" ORDER BY "fullName" ASC LIMIT 200')
          : await pool.query('SELECT full_name FROM app_users ORDER BY full_name ASC LIMIT 200');
      directoryMembers = directoryRows.rows.map((row: { full_name?: string }) => row.full_name?.trim() || '').filter(Boolean);

      const directoryCompletionResult =
        memberTable === '"Member"'
          ? await pool.query(
              'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "phoneNumber" IS NOT NULL AND TRIM("phoneNumber") <> \'\')::int AS complete FROM "Member"'
            )
          : await pool.query(
              'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE phone_number IS NOT NULL AND TRIM(phone_number) <> \'\')::int AS complete FROM app_users'
            );

      const directoryTotal = Number(directoryCompletionResult.rows[0]?.total ?? 0);
      const directoryComplete = Number(directoryCompletionResult.rows[0]?.complete ?? 0);
      directoryCompletionRate = directoryTotal ? (directoryComplete / directoryTotal) * 100 : 0;
    } catch (error) {
      console.warn('Mobile dashboard member section fallback', error);
    }

    if (contributionTable) {
      try {
        const completionResult = await pool.query(
          'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = \'PAID\')::int AS paid FROM "Contribution"'
        );
        const total = Number(completionResult.rows[0]?.total ?? 0);
        const paid = Number(completionResult.rows[0]?.paid ?? 0);
        completionRate = total ? (paid / total) * 100 : 0;
      } catch (error) {
        console.warn('Mobile dashboard contribution section fallback', error);
      }
    }

    if (funeralCaseTable) {
      try {
        activeCasesCount = await queryCount('SELECT COUNT(*)::int AS count FROM "FuneralCase" WHERE "isActive" = true');

        upcomingMoments = (
          await pool.query(
            'SELECT id, "funeralDate", "funeralLocation" FROM "FuneralCase" WHERE "funeralDate" >= NOW() ORDER BY "funeralDate" ASC LIMIT 5'
          )
        ).rows.map((row: { id: string; funeralDate: string | Date; funeralLocation: string }) => ({
          id: row.id,
          title: 'Upcoming Funeral Support',
          detail: `${new Date(row.funeralDate).toLocaleDateString()} • ${row.funeralLocation}`
        }));

        funeralCases = (
          await pool.query(
            'SELECT id, "funeralDate", "funeralLocation", "contributionPerMember", "isActive" FROM "FuneralCase" ORDER BY "funeralDate" DESC LIMIT 20'
          )
        ).rows.map(
          (row: {
            id: string;
            funeralDate: string | Date;
            funeralLocation: string;
            contributionPerMember: number | string;
            isActive: boolean;
          }) => ({
            id: row.id,
            funeralDate: new Date(row.funeralDate).toISOString(),
            funeralLocation: row.funeralLocation,
            contributionPerMember: Number(row.contributionPerMember || 0),
            isActive: Boolean(row.isActive)
          })
        );
      } catch (error) {
        console.warn('Mobile dashboard funeral section fallback', error);
      }
    }

    if (notificationTable) {
      try {
        notifications = (
          await pool.query(
            'SELECT id, title, message, "createdAt" FROM "Notification" ORDER BY "createdAt" DESC LIMIT 8'
          )
        ).rows.map((row: { id: string; title: string; message: string; createdAt: string | Date }) => ({
          id: row.id,
          title: row.title,
          message: row.message,
          createdAt: new Date(row.createdAt).toISOString()
        }));
      } catch (error) {
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
  } catch (error) {
    console.error('Mobile dashboard fetch error', error);
    res.status(500).json({ success: false, message: 'Failed to load mobile dashboard data.' });
  }
});

app.get('/api/mobile/family', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  try {
    const family = await buildFamilySnapshot(userId);
    res.json({ success: true, family });
  } catch (error) {
    console.error('Mobile family fetch error', error);
    res.status(500).json({ success: false, message: 'Failed to load family connections.' });
  }
});

app.get('/api/mobile/family/suggestions', authenticate, async (req: AuthRequest, res: Response) => {
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
    const params: Array<string | number> = [userId];
    const conditions: string[] = [];

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
  } catch (error) {
    console.error('Mobile family suggestion error', error);
    res.status(500).json({ success: false, message: 'Failed to search family members.' });
  }
});

app.post('/api/mobile/family/link', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const relationshipType =
    req.body.relationshipType === 'spouse' ||
    req.body.relationshipType === 'child' ||
    req.body.relationshipType === 'parent' ||
    req.body.relationshipType === 'sibling'
      ? (req.body.relationshipType as FamilyRelationType)
      : null;

  if (!relationshipType) {
    res.status(400).json({ success: false, message: 'relationshipType must be spouse, child, parent, or sibling.' });
    return;
  }

  const targetUserIdInput = req.body.targetUserId;
  let targetUserId = typeof targetUserIdInput === 'number' ? targetUserIdInput : Number(targetUserIdInput);
  const sourceUserIdInput = req.body.sourceUserId;
  const requestedSourceUserId = typeof sourceUserIdInput === 'number' ? sourceUserIdInput : Number(sourceUserIdInput);

  const memberPayload = typeof req.body.member === 'object' && req.body.member ? (req.body.member as Record<string, unknown>) : null;
  const forceCreate = Boolean(req.body.forceCreate);

  try {
    let sourceUserId = userId;

    if (Number.isFinite(requestedSourceUserId) && requestedSourceUserId > 0 && requestedSourceUserId !== userId) {
      const allowedSource = await pool.query(
        `
          SELECT target_user_id
          FROM app_family_relationships
          WHERE source_user_id = $1 AND target_user_id = $2 AND relationship_type = 'spouse'
          LIMIT 1
        `,
        [userId, requestedSourceUserId]
      );

      if (!allowedSource.rowCount) {
        res.status(403).json({ success: false, message: 'You can only add relatives for yourself or your spouse.' });
        return;
      }

      sourceUserId = requestedSourceUserId;
    }

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

      const duplicateParams: Array<string | number> = [sourceUserId];
      const duplicateConditions: string[] = [];
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

      const duplicateResult = await pool.query(
        `
          SELECT id, full_name, phone_number, birth_year, location, gender, photo_url, notes
          FROM app_users
          WHERE id <> $1
            AND (${duplicateConditions.join(' OR ')})
          ORDER BY full_name ASC
          LIMIT 8
        `,
        duplicateParams
      );

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

      const placeholderHash = await bcrypt.hash(`family-link-${Date.now()}`, 10);
      const created = await pool.query(
        `
          INSERT INTO app_users (full_name, email, phone_number, birth_year, location, gender, photo_url, notes, role, password_hash, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'MEMBER', $9, $10)
          RETURNING id
        `,
        [
          fullName,
          emailToUse,
          phoneNumber,
          Number.isFinite(birthYear) ? Number(birthYear) : null,
          location,
          gender,
          photoUrl,
          notes,
          placeholderHash,
          sourceUserId
        ]
      );
      targetUserId = Number(created.rows[0]?.id);
    }

    if (!Number.isFinite(targetUserId) || targetUserId <= 0 || targetUserId === sourceUserId) {
      res.status(400).json({ success: false, message: 'Invalid target member selection.' });
      return;
    }

    const targetExists = await pool.query('SELECT id FROM app_users WHERE id = $1 LIMIT 1', [targetUserId]);
    if (!targetExists.rowCount) {
      res.status(404).json({ success: false, message: 'Target member not found.' });
      return;
    }

    if (relationshipType === 'spouse') {
      await ensureFamilyLink(sourceUserId, targetUserId, 'spouse');
      await ensureFamilyLink(targetUserId, sourceUserId, 'spouse');
    }

    if (relationshipType === 'parent') {
      await ensureFamilyLink(targetUserId, sourceUserId, 'parent');
      await ensureFamilyLink(sourceUserId, targetUserId, 'child');
    }

    if (relationshipType === 'child') {
      await ensureFamilyLink(sourceUserId, targetUserId, 'parent');
      await ensureFamilyLink(targetUserId, sourceUserId, 'child');

      const spouseRows = await pool.query(
        'SELECT target_user_id FROM app_family_relationships WHERE source_user_id = $1 AND relationship_type = $2 LIMIT 1',
        [sourceUserId, 'spouse']
      );
      const spouseId = Number(spouseRows.rows[0]?.target_user_id || 0);
      if (spouseId) {
        await ensureFamilyLink(spouseId, targetUserId, 'parent');
        await ensureFamilyLink(targetUserId, spouseId, 'child');
      }
    }

    if (relationshipType === 'sibling') {
      await ensureFamilyLink(sourceUserId, targetUserId, 'sibling');
      await ensureFamilyLink(targetUserId, sourceUserId, 'sibling');

      const sourceParents = await pool.query(
        'SELECT source_user_id FROM app_family_relationships WHERE target_user_id = $1 AND relationship_type = $2',
        [sourceUserId, 'parent']
      );
      const targetParents = await pool.query(
        'SELECT source_user_id FROM app_family_relationships WHERE target_user_id = $1 AND relationship_type = $2',
        [targetUserId, 'parent']
      );

      const sourceParentIds = sourceParents.rows.map((row: { source_user_id: number }) => Number(row.source_user_id));
      const targetParentIds = targetParents.rows.map((row: { source_user_id: number }) => Number(row.source_user_id));

      if (sourceParentIds.length) {
        for (const parentId of sourceParentIds) {
          await ensureFamilyLink(parentId, targetUserId, 'parent');
          await ensureFamilyLink(targetUserId, parentId, 'child');
        }
      }

      if (targetParentIds.length) {
        for (const parentId of targetParentIds) {
          await ensureFamilyLink(parentId, sourceUserId, 'parent');
          await ensureFamilyLink(sourceUserId, parentId, 'child');
        }
      }
    }

    const family = await buildFamilySnapshot(userId);
    res.json({ success: true, message: 'Family member linked successfully.', family });
  } catch (error) {
    console.error('Mobile family link error', error);
    res.status(500).json({ success: false, message: 'Failed to link family member.' });
  }
});

app.get('/api/mobile/members/:id/suggestions', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const memberId = Number(req.params.id);
  if (!Number.isFinite(memberId) || memberId <= 0) {
    res.status(400).json({ success: false, message: 'Invalid member id.' });
    return;
  }

  const type = typeof req.query.type === 'string' ? req.query.type : 'siblings';
  if (type !== 'siblings') {
    res.status(400).json({ success: false, message: 'Unsupported suggestion type.' });
    return;
  }

  try {
    const exists = await pool.query('SELECT id FROM app_users WHERE id = $1 LIMIT 1', [memberId]);
    if (!exists.rowCount) {
      res.status(404).json({ success: false, message: 'Member not found.' });
      return;
    }

    const parentRows = await pool.query(
      'SELECT source_user_id FROM app_family_relationships WHERE target_user_id = $1 AND relationship_type = $2',
      [memberId, 'parent']
    );

    const parentIds = parentRows.rows.map((row: { source_user_id: number }) => Number(row.source_user_id)).filter(Boolean);
    if (!parentIds.length) {
      res.json({ success: true, suggestions: [] });
      return;
    }

    const siblings = (
      await pool.query(
        `
          SELECT DISTINCT u.id, u.full_name, u.phone_number, u.birth_year, u.location, u.gender, u.photo_url, u.notes,
                          u.clan_name, u.totem, u.tribe, u.origin_country
          FROM app_family_relationships fr
          JOIN app_users u ON u.id = fr.target_user_id
          WHERE fr.relationship_type = 'parent'
            AND fr.source_user_id = ANY($2::int[])
            AND fr.target_user_id <> $1
          ORDER BY u.full_name ASC
          LIMIT 20
        `,
        [memberId, parentIds]
      )
    ).rows.map(toFamilyMemberSummary);

    res.json({ success: true, suggestions: siblings });
  } catch (error) {
    console.error('Mobile member suggestion error', error);
    res.status(500).json({ success: false, message: 'Failed to load sibling suggestions.' });
  }
});

app.get('/api/mobile/members/:id/memories', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const memberId = Number(req.params.id);
  if (!Number.isFinite(memberId) || memberId <= 0) {
    res.status(400).json({ success: false, message: 'Invalid member id.' });
    return;
  }

  try {
    const exists = await pool.query('SELECT id FROM app_users WHERE id = $1 LIMIT 1', [memberId]);
    if (!exists.rowCount) {
      res.status(404).json({ success: false, message: 'Member not found.' });
      return;
    }

    const result = await pool.query(
      `
        SELECT id, member_id, title, description, file_url, type, created_by_user_id, created_at
        FROM app_family_memories
        WHERE member_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `,
      [memberId]
    );

    const memories: FamilyMemorySummary[] = result.rows.map((row: any) => ({
      id: Number(row.id),
      memberId: Number(row.member_id),
      title: String(row.title),
      description: row.description ? String(row.description) : null,
      fileUrl: String(row.file_url),
      type: row.type as FamilyMemoryType,
      createdByUserId: Number(row.created_by_user_id),
      createdAt: new Date(row.created_at).toISOString()
    }));

    res.json({ success: true, memories });
  } catch (error) {
    console.error('Mobile member memories fetch error', error);
    res.status(500).json({ success: false, message: 'Failed to load memories.' });
  }
});

app.post('/api/mobile/members/:id/memories', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const memberId = Number(req.params.id);
  if (!Number.isFinite(memberId) || memberId <= 0) {
    res.status(400).json({ success: false, message: 'Invalid member id.' });
    return;
  }

  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  const fileUrl = typeof req.body.fileUrl === 'string' ? req.body.fileUrl.trim() : '';
  const type = typeof req.body.type === 'string' ? req.body.type.trim().toUpperCase() : '';

  const allowedTypes = new Set(['PHOTO', 'AUDIO', 'VIDEO', 'DOCUMENT']);
  if (!title || title.length < 2 || !fileUrl) {
    res.status(400).json({ success: false, message: 'title and fileUrl are required.' });
    return;
  }
  if (!allowedTypes.has(type)) {
    res.status(400).json({ success: false, message: 'type must be PHOTO, AUDIO, VIDEO, or DOCUMENT.' });
    return;
  }

  try {
    const exists = await pool.query('SELECT id FROM app_users WHERE id = $1 LIMIT 1', [memberId]);
    if (!exists.rowCount) {
      res.status(404).json({ success: false, message: 'Member not found.' });
      return;
    }

    const created = await pool.query(
      `
        INSERT INTO app_family_memories (member_id, title, description, file_url, type, created_by_user_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, member_id, title, description, file_url, type, created_by_user_id, created_at
      `,
      [memberId, title, description || null, fileUrl, type, userId]
    );

    const row = created.rows[0];
    const memory: FamilyMemorySummary = {
      id: Number(row.id),
      memberId: Number(row.member_id),
      title: String(row.title),
      description: row.description ? String(row.description) : null,
      fileUrl: String(row.file_url),
      type: row.type as FamilyMemoryType,
      createdByUserId: Number(row.created_by_user_id),
      createdAt: new Date(row.created_at).toISOString()
    };

    res.status(201).json({ success: true, memory });
  } catch (error) {
    console.error('Mobile member memory create error', error);
    res.status(500).json({ success: false, message: 'Failed to save memory.' });
  }
});

app.put('/api/mobile/members/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const memberId = Number(req.params.id);
  if (!Number.isFinite(memberId) || memberId <= 0) {
    res.status(400).json({ success: false, message: 'Invalid member id.' });
    return;
  }

  if (!canEditMember(userId, req.user?.role, memberId)) {
    res.status(403).json({ success: false, message: 'Forbidden.' });
    return;
  }

  const clanName = typeof req.body.clanName === 'string' ? req.body.clanName.trim() : undefined;
  const totem = typeof req.body.totem === 'string' ? req.body.totem.trim() : undefined;
  const tribe = typeof req.body.tribe === 'string' ? req.body.tribe.trim() : undefined;
  const originCountry = typeof req.body.originCountry === 'string' ? req.body.originCountry.trim() : undefined;

  const updates: string[] = [];
  const params: Array<string | number | null> = [];

  if (clanName !== undefined) {
    params.push(clanName || null);
    updates.push(`clan_name = $${params.length}`);
  }
  if (totem !== undefined) {
    params.push(totem || null);
    updates.push(`totem = $${params.length}`);
  }
  if (tribe !== undefined) {
    params.push(tribe || null);
    updates.push(`tribe = $${params.length}`);
  }
  if (originCountry !== undefined) {
    params.push(originCountry || null);
    updates.push(`origin_country = $${params.length}`);
  }

  if (!updates.length) {
    res.status(400).json({ success: false, message: 'No editable fields provided.' });
    return;
  }

  params.push(memberId);

  try {
    const updated = await pool.query(
      `
        UPDATE app_users
        SET ${updates.join(', ')}
        WHERE id = $${params.length}
        RETURNING id, full_name, phone_number, birth_year, location, gender, photo_url, notes, clan_name, totem, tribe, origin_country
      `,
      params
    );

    if (!updated.rowCount) {
      res.status(404).json({ success: false, message: 'Member not found.' });
      return;
    }

    res.json({ success: true, member: toFamilyMemberSummary(updated.rows[0]) });
  } catch (error) {
    console.error('Mobile member update error', error);
    res.status(500).json({ success: false, message: 'Failed to update member.' });
  }
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'ubuntu-roots-backend',
    status: 'ok'
  });
});

app.get('/api/info', (_req: Request, res: Response) => {
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
