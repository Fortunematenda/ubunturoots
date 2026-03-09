import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FamilyTreeEngine, type FamilyTreeNode } from './components/tree/FamilyTreeEngine';

type ScreenKey = 'home' | 'directory' | 'tree' | 'funeralCases' | 'notifications' | 'profile';

type QuickAction = {
  label: string;
  screen: Exclude<ScreenKey, 'home'>;
};

type BottomNavItem = {
  icon: string;
  label: string;
  screen: ScreenKey;
};

type AuthMode = 'signup' | 'login';

type AuthUser = {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string | null;
};

type AuthResponse = {
  success?: boolean;
  message?: string;
  token?: string;
  user?: AuthUser;
};

type DashboardStats = {
  membersCount: number;
  householdsCount: number;
  activeCasesCount: number;
  completionRate: number;
  directoryCompletionRate: number;
};

type DashboardNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
};

type DashboardUpcomingMoment = {
  id: string;
  title: string;
  detail: string;
};

type DashboardFuneralCase = {
  id: string;
  funeralDate: string;
  funeralLocation: string;
  contributionPerMember: number;
  isActive: boolean;
};

type DashboardPayload = {
  stats: DashboardStats;
  directoryMembers: string[];
  notifications: DashboardNotification[];
  upcomingMoments: DashboardUpcomingMoment[];
  funeralCases: DashboardFuneralCase[];
};

type DashboardResponse = {
  success?: boolean;
  message?: string;
  dashboard?: DashboardPayload;
};

type FamilyMember = {
  id: number;
  fullName: string;
  phoneNumber: string | null;
  birthYear: number | null;
  deathDate?: string | null;
  location: string | null;
  gender?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  clanName?: string | null;
  totem?: string | null;
  tribe?: string | null;
  originCountry?: string | null;
};

type FamilyMemoryType = 'PHOTO' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';

type FamilyMemory = {
  id: number;
  memberId: number;
  title: string;
  description: string | null;
  fileUrl: string;
  type: FamilyMemoryType;
  createdAt: string;
};

type FamilySnapshot = {
  parents: FamilyMember[];
  ownParents?: FamilyMember[];
  spouseParents?: FamilyMember[];
  spouse: FamilyMember | null;
  children: FamilyMember[];
  siblings: FamilyMember[];
};

type FamilyApiResponse = {
  success?: boolean;
  message?: string;
  family?: FamilySnapshot;
  suggestions?: FamilyMember[];
};

function mapFamilyMemberToTreeNode(member: FamilyMember): FamilyTreeNode {
  return {
    id: String(member.id),
    name: member.fullName
  };
}

function buildFamilyTreeEngineData(memberName: string, family: FamilySnapshot | null): FamilyTreeNode {
  const ownParents = family?.ownParents ?? family?.parents ?? [];
  const spouseParents = family?.spouseParents ?? [];
  const spouse = family?.spouse;
  const children = family?.children ?? [];

  const rootNode: FamilyTreeNode = {
    id: 'you',
    name: memberName,
    parents: ownParents.map(mapFamilyMemberToTreeNode),
    children: children.map(mapFamilyMemberToTreeNode)
  };

  if (spouse) {
    rootNode.spouse = {
      id: String(spouse.id),
      name: spouse.fullName,
      parents: spouseParents.map(mapFamilyMemberToTreeNode)
    };
  }

  return rootNode;
}

const FAMILY_RELATION_OPTIONS: Array<{ value: 'spouse' | 'child' | 'parent' | 'sibling'; label: string }> = [
  { value: 'spouse', label: 'Add Spouse' },
  { value: 'child', label: 'Add Child' },
  { value: 'parent', label: 'Add Parent' },
  { value: 'sibling', label: 'Add Sibling' }
];

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Member Directory', screen: 'directory' },
  { label: 'Family Tree', screen: 'tree' },
  { label: 'Funeral Cases', screen: 'funeralCases' },
  { label: 'Notifications', screen: 'notifications' },
  { label: 'Profile', screen: 'profile' }
];

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { icon: '', label: 'Home', screen: 'home' },
  { icon: '', label: 'Directory', screen: 'directory' },
  { icon: '', label: 'Tree', screen: 'tree' },
  { icon: '', label: 'Cases', screen: 'funeralCases' },
  { icon: '', label: 'Profile', screen: 'profile' }
];

function LandingBackground() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 14000,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true
      })
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.85, 1, 0.85] });
  const drift = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });

  return (
    <Animated.View
      style={[styles.landingBg, { opacity, transform: [{ translateY: drift }, { scale }] }]}
      pointerEvents="none"
    >
      <View style={styles.landingBgBase} />
      <View style={styles.landingBgOverlay} />
      <View style={styles.landingBgCircleA} />
      <View style={styles.landingBgCircleB} />
      <View style={styles.landingBgCircleC} />
      <View style={styles.landingBgRootLine} />
      <View style={styles.landingBgRootLine2} />
    </Animated.View>
  );
}

  function MobileFamilyTree({
  memberName,
  familyData,
  isLoading,
  error,
  onAddFromNode
}: {
  memberName: string;
  familyData: FamilySnapshot | null;
  isLoading: boolean;
  error: string;
  onAddFromNode: (member: FamilyMember, relation: 'spouse' | 'child' | 'parent' | 'sibling') => void;
}) {
  const ownParents = familyData?.ownParents ?? familyData?.parents ?? [];
  const spouseParents = familyData?.spouseParents ?? [];
  const children = familyData?.children ?? [];
  const siblings = familyData?.siblings ?? [];
  const spouse = familyData?.spouse;

  const primaryMember: FamilyMember & { relationLabel: string } = {
    id: -1,
    fullName: memberName,
    phoneNumber: null,
    birthYear: null,
    location: null,
    relationLabel: 'You'
  };

  if (isLoading) {
    return (
      <View style={styles.treePanel}>
        <Text>Loading family tree...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.treePanel}>
        <Text>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.treePanel}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.treeCanvas}>

          <CoupleRow
            ownParents={ownParents.map((p) => ({ ...p, relationLabel: 'Parent' }))}
            primaryMember={primaryMember}
            spouse={spouse ? { ...spouse, relationLabel: 'Spouse' } : null}
            spouseParents={spouseParents.map((p) => ({ ...p, relationLabel: 'Parent' }))}
            onAdd={onAddFromNode}
          />

          {children.length > 0 ? <TreeConnector /> : null}

          {children.length > 0 ? <TreeRow label="Children" members={children.map((c) => ({ ...c, relationLabel: 'Child' }))} onAdd={onAddFromNode} /> : null}

          {siblings.length > 0 && (
            <TreeRow
              label="Siblings"
              members={siblings.map((s) => ({ ...s, relationLabel: 'Sibling' }))}
              onAdd={onAddFromNode}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function CoupleRow({
  ownParents,
  primaryMember,
  spouse,
  spouseParents,
  onAdd
}: {
  ownParents: Array<FamilyMember & { relationLabel: string }>;
  primaryMember: FamilyMember & { relationLabel: string };
  spouse: (FamilyMember & { relationLabel: string }) | null;
  spouseParents: Array<FamilyMember & { relationLabel: string }>;
  onAdd: (member: FamilyMember, relation: 'spouse' | 'child' | 'parent' | 'sibling') => void;
}) {
  return (
    <View style={styles.treeLevel}>
      <Text style={styles.treeLevelLabel}>You</Text>
      <View style={styles.treeTopParentGrid}>
        <View style={styles.treeTopParentColumn}>
          <View style={styles.treeTopParentRow}>
            {ownParents.map((parent) => (
              <TreePersonCard
                key={parent.id}
                member={parent}
                showParentActions={false}
                onAddFatherPress={() => onAdd(parent, 'parent')}
                onAddMotherPress={() => onAdd(parent, 'parent')}
                onAddPress={() => onAdd(parent, 'child')}
              />
            ))}
          </View>
          {ownParents.length > 0 ? (
            <View style={styles.treeTopJoinWrap}>
              <View style={styles.treeTopJoinHorizontal} />
              <View style={styles.treeTopConnectorLine} />
            </View>
          ) : null}
        </View>
        <View style={styles.treeTopParentColumn}>
          <View style={styles.treeTopParentRow}>
            {spouseParents.map((parent) => (
              <TreePersonCard
                key={parent.id}
                member={parent}
                showParentActions={false}
                onAddFatherPress={() => onAdd(parent, 'parent')}
                onAddMotherPress={() => onAdd(parent, 'parent')}
                onAddPress={() => onAdd(parent, 'child')}
              />
            ))}
          </View>
          {spouseParents.length > 0 ? (
            <View style={styles.treeTopJoinWrap}>
              <View style={styles.treeTopJoinHorizontal} />
              <View style={styles.treeTopConnectorLine} />
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.treeCoupleWrap}>
        <TreePersonCard
          member={primaryMember}
          showParentActions
          onAddFatherPress={() => onAdd(primaryMember, 'parent')}
          onAddMotherPress={() => onAdd(primaryMember, 'parent')}
          onAddPress={() => onAdd(primaryMember, spouse ? 'child' : 'spouse')}
        />
        {spouse ? <View style={styles.treeCoupleLine} /> : null}
        {spouse ? (
          <TreePersonCard
            member={spouse}
            showParentActions
            onAddFatherPress={() => onAdd(spouse, 'parent')}
            onAddMotherPress={() => onAdd(spouse, 'parent')}
            onAddPress={() => onAdd(spouse, 'child')}
          />
        ) : null}
      </View>
    </View>
  );
}

  function TreeRow({
  label,
  members,
  onAdd
}: {
  label: string;
  members: Array<FamilyMember & { relationLabel: string }>;
  onAdd: (member: FamilyMember, relation: 'spouse' | 'child' | 'parent' | 'sibling') => void;
}) {
  return (
    <View style={styles.treeLevel}>
      <Text style={styles.treeLevelLabel}>{label}</Text>

      <View style={styles.treeRowWrap}>
        {members.map((member) => (
          <TreePersonCard
            key={member.id}
            member={member}
            showParentActions={false}
            onAddFatherPress={() => onAdd(member, 'parent')}
            onAddMotherPress={() => onAdd(member, 'parent')}
            onAddPress={() => onAdd(member, 'child')}
          />
        ))}
      </View>
    </View>
  );
}

function TreePersonCard({
  member,
  showParentActions,
  onAddFatherPress,
  onAddMotherPress,
  onAddPress
}: {
  member: FamilyMember & { relationLabel: string };
  showParentActions: boolean;
  onAddFatherPress: () => void;
  onAddMotherPress: () => void;
  onAddPress: () => void;
}) {
  const initials = member.fullName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
  const deathDateLabel = member.deathDate ? new Date(member.deathDate).toLocaleDateString() : null;

  return (
    <View style={styles.treeNodeWrap}>
      {showParentActions ? (
        <View style={styles.treeParentActionRow}>
          <Pressable style={styles.treeParentActionButton} onPress={onAddFatherPress}>
            <Text style={styles.treeParentActionText}>Father</Text>
          </Pressable>
          <Pressable style={styles.treeParentActionButton} onPress={onAddMotherPress}>
            <Text style={styles.treeParentActionText}>Mother</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.treeNodeCard}>
      <View style={styles.treeNodeAvatar}>
        <Text style={styles.treeNodeAvatarText}>{initials}</Text>
      </View>

      <Text numberOfLines={2} style={styles.treeNodeName}>
        {member.fullName}
      </Text>

      {member.birthYear ? <Text style={styles.treeNodeMeta}>DOB: {member.birthYear}</Text> : null}
      {deathDateLabel ? <Text style={styles.treeNodeMeta}>DOD: {deathDateLabel}</Text> : null}

      <Pressable style={styles.treeNodeAddButton} onPress={onAddPress}>
        <Text style={styles.treeNodeAddButtonText}>+</Text>
      </Pressable>
      </View>
    </View>
  );
}

function TreeConnector() {
  return (
    <View style={styles.treeConnectorWrap}>
      <View style={styles.treeConnectorLine} />
    </View>
  );
}

const API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:4000',
  default: 'http://localhost:4000'
}) ?? 'http://localhost:4000';

const RESOLVED_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || API_BASE_URL;

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenKey>('home');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState('');
  const [authError, setAuthError] = useState('');
  const [authInfo, setAuthInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profilePhoneNumber, setProfilePhoneNumber] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileInfo, setProfileInfo] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [shouldFocusDirectorySearch, setShouldFocusDirectorySearch] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [familyData, setFamilyData] = useState<FamilySnapshot | null>(null);
  const [isFamilyLoading, setIsFamilyLoading] = useState(false);
  const [isFamilySaving, setIsFamilySaving] = useState(false);
  const [familyError, setFamilyError] = useState('');
  const [familyInfo, setFamilyInfo] = useState('');
  const [familyRelationType, setFamilyRelationType] = useState<'spouse' | 'child' | 'parent' | 'sibling'>('spouse');
  const [familyEntryMode, setFamilyEntryMode] = useState<'existing' | 'new'>('existing');
  const [showAdvancedFamilyFields, setShowAdvancedFamilyFields] = useState(false);
  const [familyFullName, setFamilyFullName] = useState('');
  const [familyPhoneNumber, setFamilyPhoneNumber] = useState('');
  const [familyBirthYear, setFamilyBirthYear] = useState('');
  const [familyLocation, setFamilyLocation] = useState('');
  const [familyEmail, setFamilyEmail] = useState('');
  const [familyGender, setFamilyGender] = useState('');
  const [familyPhotoUrl, setFamilyPhotoUrl] = useState('');
  const [familyNotes, setFamilyNotes] = useState('');
  const [familySuggestions, setFamilySuggestions] = useState<FamilyMember[]>([]);
  const [familySourceMemberId, setFamilySourceMemberId] = useState<number | null>(null);
  const directorySearchRef = useRef<TextInput>(null);
  const landingIntroAnim = useRef(new Animated.Value(0)).current;

  const currentPhoneNumber = authUser?.phoneNumber || 'No phone yet';
  const currentMemberName = authUser?.fullName?.split(' ')[0] || 'Family Member';

  useEffect(() => {
    if (activeScreen !== 'directory' || !shouldFocusDirectorySearch) return;

    const timer = setTimeout(() => {
      directorySearchRef.current?.focus();
      setShouldFocusDirectorySearch(false);
    }, 60);

    return () => clearTimeout(timer);
  }, [activeScreen, shouldFocusDirectorySearch]);

  useEffect(() => {
    if (isAuthenticated || !showLanding) return;

    landingIntroAnim.setValue(0);
    Animated.timing(landingIntroAnim, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [isAuthenticated, showLanding, landingIntroAnim]);

  useEffect(() => {
    if (!isAuthenticated || !authToken) {
      setDashboardData(null);
      setDashboardError('');
      setIsDashboardLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadDashboard = async () => {
      setIsDashboardLoading(true);
      setDashboardError('');

      try {
        const response = await fetch(`${RESOLVED_API_BASE_URL}/api/mobile/dashboard`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`
          },
          signal: controller.signal
        });

        const rawBody = await response.text();
        let data: DashboardResponse = {};
        if (rawBody) {
          try {
            data = JSON.parse(rawBody) as DashboardResponse;
          } catch {
            data = {};
          }
        }

        if (!response.ok) {
          if (response.status === 404) {
            setDashboardError('Dashboard endpoint not found (404). Restart backend so latest API routes are loaded.');
            return;
          }

          if (response.status === 401) {
            setDashboardError(data.message || 'Session expired. Please log out and log in again.');
            return;
          }

          setDashboardError(data.message || `Could not load dashboard data (HTTP ${response.status}).`);
          return;
        }

        if (!data.success || !data.dashboard) {
          setDashboardError(data.message || 'Could not load dashboard data.');
          return;
        }

        setDashboardData(data.dashboard);
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'AbortError') {
          setDashboardError('Could not reach backend while loading dashboard data.');
        }
      } finally {
        setIsDashboardLoading(false);
      }
    };

    loadDashboard();

    return () => {
      controller.abort();
    };
  }, [isAuthenticated, authToken]);

  useEffect(() => {
    if (!isAuthenticated || !authToken) {
      setFamilyData(null);
      setFamilyError('');
      setFamilyInfo('');
      setFamilySuggestions([]);
      setFamilySourceMemberId(null);
      setIsFamilyLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadFamily = async () => {
      setIsFamilyLoading(true);
      setFamilyError('');

      try {
        const response = await fetch(`${RESOLVED_API_BASE_URL}/api/mobile/family`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`
          },
          signal: controller.signal
        });

        const payload = (await response.json().catch(() => ({}))) as FamilyApiResponse;
        if (!response.ok || !payload.success) {
          setFamilyError(payload.message || 'Could not load family connections.');
          return;
        }

        setFamilyData(payload.family || null);
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'AbortError') {
          setFamilyError('Could not reach backend while loading family connections.');
        }
      } finally {
        setIsFamilyLoading(false);
      }
    };

    loadFamily();

    return () => {
      controller.abort();
    };
  }, [isAuthenticated, authToken]);

  const handleSearchPress = () => {
    setIsProfileMenuOpen(false);
    setDirectoryQuery('');
    setShouldFocusDirectorySearch(true);
    setActiveScreen('directory');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthUser(null);
    setAuthToken('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setAuthError('');
    setAuthInfo('');
    setProfilePhoneNumber('');
    setProfileError('');
    setProfileInfo('');
    setFamilyData(null);
    setFamilyError('');
    setFamilyInfo('');
    setFamilySuggestions([]);
    setFamilyFullName('');
    setFamilyPhoneNumber('');
    setFamilyBirthYear('');
    setFamilyLocation('');
    setFamilyEmail('');
    setFamilyGender('');
    setFamilyPhotoUrl('');
    setFamilyNotes('');
    setShowAdvancedFamilyFields(false);
    setIsProfileMenuOpen(false);
    setShowLanding(true);
    setAuthMode('login');
  };

  const handleAuthSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedConfirmPassword = confirmPassword.trim();

    setAuthError('');
    setAuthInfo('');

    if (!normalizedEmail || !normalizedPassword || (authMode === 'signup' && (!normalizedFirstName || !normalizedLastName))) {
      setAuthError('Please complete all required fields.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setAuthError('Please enter a valid email address.');
      return;
    }

    if (authMode === 'signup' && normalizedPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    if (authMode === 'signup' && normalizedPassword !== normalizedConfirmPassword) {
      setAuthError('Password and confirm password do not match.');
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      setIsSubmitting(true);
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 12000);

      const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const payload =
        authMode === 'signup'
          ? {
              firstName: normalizedFirstName,
              lastName: normalizedLastName,
              email: normalizedEmail,
              password: normalizedPassword
            }
          : {
              email: normalizedEmail,
              password: normalizedPassword
            };

      const response = await fetch(`${RESOLVED_API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify(payload)
      });

      const data = (await response.json().catch(() => ({}))) as AuthResponse;

      if (!response.ok || !data.success) {
        setAuthError(data.message || 'Authentication failed.');
        return;
      }

      if (authMode === 'signup') {
        setAuthMode('login');
        setPassword('');
        setConfirmPassword('');
        setAuthInfo('Account created. Now login with your email and password.');
        return;
      }

      if (!data.user || !data.token) {
        setAuthError('Invalid backend response. Missing login credentials.');
        return;
      }

      setAuthUser(data.user);
      setAuthToken(data.token);
      setIsAuthenticated(true);
      setActiveScreen('home');
      setPassword('');
      setConfirmPassword('');
      setProfilePhoneNumber(data.user.phoneNumber || '');
      setProfileError('');
      setProfileInfo('');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setAuthError(`Request timed out. API ${RESOLVED_API_BASE_URL} is unreachable. If using a real phone, set EXPO_PUBLIC_API_BASE_URL to your computer LAN IP (e.g. http://192.168.1.50:4000).`);
      } else {
        setAuthError(`Unable to connect to ${RESOLVED_API_BASE_URL}. If using a real phone, use your computer LAN IP instead of localhost.`);
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setIsSubmitting(false);
    }
  };

  const searchFamilySuggestions = async () => {
    if (!authToken) {
      setFamilyError('Login again to manage family connections.');
      return;
    }

    const hasInput = Boolean(familyFullName.trim() || familyPhoneNumber.trim() || familyBirthYear.trim());
    if (!hasInput) {
      setFamilyError('Enter at least name, phone, or birth year to search.');
      return;
    }

    setFamilyError('');
    setFamilyInfo('');
    setIsFamilySaving(true);

    const params = new URLSearchParams();
    if (familyFullName.trim()) params.set('fullName', familyFullName.trim());
    if (familyPhoneNumber.trim()) params.set('phoneNumber', familyPhoneNumber.trim());
    if (familyBirthYear.trim()) params.set('birthYear', familyBirthYear.trim());

    try {
      const response = await fetch(`${RESOLVED_API_BASE_URL}/api/mobile/family/suggestions?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      const payload = (await response.json().catch(() => ({}))) as FamilyApiResponse;
      if (!response.ok || !payload.success) {
        setFamilyError(payload.message || 'Could not search family members.');
        return;
      }

      setFamilySuggestions(payload.suggestions || []);
      setFamilyInfo('Search complete. Link an existing person or create new.');
    } catch {
      setFamilyError('Could not reach backend while searching family members.');
    } finally {
      setIsFamilySaving(false);
    }
  };

  const submitFamilyLink = async (targetUserId?: number, forceCreate?: boolean) => {
    if (!authToken) {
      setFamilyError('Login again to manage family connections.');
      return;
    }

    if (!targetUserId && !familyFullName.trim()) {
      setFamilyError('Enter a family member name first.');
      return;
    }

    setFamilyError('');
    setFamilyInfo('');
    setIsFamilySaving(true);

    const payload: Record<string, unknown> = {
      relationshipType: familyRelationType
    };

    if (familySourceMemberId && familySourceMemberId > 0) {
      payload.sourceUserId = familySourceMemberId;
    }

    if (targetUserId) {
      payload.targetUserId = targetUserId;
    } else {
      payload.forceCreate = Boolean(forceCreate);
      payload.member = {
        fullName: familyFullName.trim(),
        phoneNumber: familyPhoneNumber.trim(),
        birthYear: familyBirthYear.trim() ? Number(familyBirthYear.trim()) : undefined,
        location: familyLocation.trim(),
        email: familyEmail.trim(),
        gender: familyGender.trim(),
        photoUrl: familyPhotoUrl.trim(),
        notes: familyNotes.trim()
      };
    }

    try {
      const response = await fetch(`${RESOLVED_API_BASE_URL}/api/mobile/family/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json().catch(() => ({}))) as FamilyApiResponse;
      if (!response.ok || !data.success) {
        setFamilyError(data.message || 'Failed to save family connection.');
        if (Array.isArray(data.suggestions)) {
          setFamilySuggestions(data.suggestions);
        }
        return;
      }

      setFamilyData(data.family || null);
      setFamilyInfo(data.message || 'Family connection saved successfully.');
      setFamilySuggestions([]);
      setFamilyFullName('');
      setFamilyPhoneNumber('');
      setFamilyBirthYear('');
      setFamilyLocation('');
      setFamilyEmail('');
      setFamilyGender('');
      setFamilyPhotoUrl('');
      setFamilyNotes('');
    } catch {
      setFamilyError('Could not reach backend while saving family connection.');
    } finally {
      setIsFamilySaving(false);
    }
  };

  const handleProfileSave = async () => {
    if (!authToken) {
      setProfileError('You need to login again before updating profile.');
      return;
    }

    const normalizedPhone = profilePhoneNumber.trim();

    setProfileError('');
    setProfileInfo('');
    setIsSavingProfile(true);

    try {
      const response = await fetch(`${RESOLVED_API_BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          phoneNumber: normalizedPhone
        })
      });

      const data = (await response.json().catch(() => ({}))) as AuthResponse;

      if (!response.ok || !data.success || !data.user) {
        setProfileError(data.message || 'Failed to update profile.');
        return;
      }

      setAuthUser(data.user);
      setProfilePhoneNumber(data.user.phoneNumber || '');
      setProfileInfo('Profile updated successfully.');
    } catch {
      setProfileError('Could not reach backend while saving profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const completionRate = Math.max(0, Math.min(100, Math.round(dashboardData?.stats.completionRate ?? 0)));
  const directoryCompletionRate = Math.max(0, Math.min(100, Math.round(dashboardData?.stats.directoryCompletionRate ?? 0)));

  const content = (() => {
    if (activeScreen === 'directory') {
      const normalizedQuery = directoryQuery.trim().toLowerCase();
      const directoryMembers =
        dashboardData?.directoryMembers && dashboardData.directoryMembers.length
          ? dashboardData.directoryMembers
          : authUser?.fullName
            ? [authUser.fullName]
            : [];
      const filteredMembers = normalizedQuery
        ? directoryMembers.filter((member) => member.toLowerCase().includes(normalizedQuery))
        : directoryMembers;

      return (
        <ScreenShell
          title="Member Directory"
          activeScreen={activeScreen}
          memberName={currentMemberName}
          isProfileMenuOpen={isProfileMenuOpen}
          onNavigate={setActiveScreen}
          onToggleProfileMenu={() => setIsProfileMenuOpen((prev) => !prev)}
          onCloseProfileMenu={() => setIsProfileMenuOpen(false)}
          onSearch={handleSearchPress}
          onBack={() => setActiveScreen('home')}
          onLogout={handleLogout}
        >
          <TextInput
            ref={directorySearchRef}
            style={styles.loginInput}
            placeholder="Search members"
            placeholderTextColor="#7AA596"
            value={directoryQuery}
            onChangeText={setDirectoryQuery}
            returnKeyType="search"
          />

          {filteredMembers.length ? (
            filteredMembers.map((member) => <InfoRow key={member} title={member} detail="Active Member" />)
          ) : (
            <InfoRow title="No results" detail="Try a different name." />
          )}
        </ScreenShell>
      );
    }

    if (activeScreen === 'profile') {
      const familyNames = {
        parents: familyData?.parents?.map((item) => item.fullName).join(' • ') || '',
        children: familyData?.children?.map((item) => item.fullName).join(' • ') || '',
        siblings: familyData?.siblings?.map((item) => item.fullName).join(' • ') || ''
      };

      return (
        <ScreenShell
          title="Profile"
          activeScreen={activeScreen}
          memberName={currentMemberName}
          isProfileMenuOpen={isProfileMenuOpen}
          onNavigate={setActiveScreen}
          onToggleProfileMenu={() => setIsProfileMenuOpen((prev) => !prev)}
          onCloseProfileMenu={() => setIsProfileMenuOpen(false)}
          onSearch={handleSearchPress}
          onBack={() => setActiveScreen('home')}
          onLogout={handleLogout}
        >
          <InfoRow title="Full Name" detail={authUser?.fullName || 'Unknown user'} />
          <InfoRow title="Email" detail={authUser?.email || 'No email'} />

          <View style={styles.profileFormWrap}>
            <Text style={styles.profileFormLabel}>Phone Number</Text>
            <TextInput
              style={styles.loginInput}
              placeholder="Add your phone number"
              placeholderTextColor="#9AA7A1"
              value={profilePhoneNumber}
              onChangeText={setProfilePhoneNumber}
            />

            {profileError ? <Text style={styles.profileErrorText}>{profileError}</Text> : null}
            {profileInfo ? <Text style={styles.profileInfoText}>{profileInfo}</Text> : null}

            <Pressable
              style={[styles.profileSaveButton, isSavingProfile && styles.loginCtaButtonDisabled]}
              onPress={handleProfileSave}
              disabled={isSavingProfile}
            >
              <Text style={styles.profileSaveButtonText}>{isSavingProfile ? 'Saving...' : 'Save Profile'}</Text>
            </Pressable>
          </View>

          <View style={styles.profileFormWrap}>
            <Text style={styles.profileFormLabel}>Family Connections</Text>
            <InfoRow
              title="Parents"
              detail={familyNames.parents || (isFamilyLoading ? 'Loading family...' : familyError ? familyError : 'No parents listed')}
            />
            <InfoRow title="Spouse" detail={familyData?.spouse?.fullName || (isFamilyLoading ? 'Loading family...' : 'No spouse listed')} />
            <InfoRow title="Children" detail={familyNames.children || (isFamilyLoading ? 'Loading family...' : 'No children listed')} />
            <InfoRow title="Siblings" detail={familyNames.siblings || (isFamilyLoading ? 'Loading family...' : 'No siblings listed')} />
          </View>

          <View style={styles.profileFormWrap}>
            <Text style={styles.profileFormLabel}>Build Immediate Family</Text>
            <View style={styles.familyBuilderCard}>
              <Text style={styles.familyHelperText}>Choose a relation, check if the person already exists, then link or create.</Text>

              <Text style={styles.familyStepLabel}>1) Who are you adding?</Text>
              <View style={styles.familyRelationGrid}>
                {FAMILY_RELATION_OPTIONS.map((item) => {
                  const active = familyRelationType === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      style={[styles.familyRelationPill, active && styles.familyRelationPillActive]}
                      onPress={() => setFamilyRelationType(item.value)}
                    >
                      <Text style={[styles.familyRelationPillText, active && styles.familyRelationPillTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.familyInlineHint}>Selected: {FAMILY_RELATION_OPTIONS.find((item) => item.value === familyRelationType)?.label || 'Add Family'}</Text>

              <Text style={styles.familyStepLabel}>2) How do you want to add them?</Text>
              <View style={styles.familySegmentRow}>
                <Pressable
                  style={[styles.familySegmentButton, familyEntryMode === 'existing' && styles.familySegmentButtonActive]}
                  onPress={() => {
                    setFamilyEntryMode('existing');
                    setShowAdvancedFamilyFields(false);
                  }}
                >
                  <Text style={[styles.familySegmentButtonText, familyEntryMode === 'existing' && styles.familySegmentButtonTextActive]}>Find Existing</Text>
                </Pressable>
                <Pressable
                  style={[styles.familySegmentButton, familyEntryMode === 'new' && styles.familySegmentButtonActive]}
                  onPress={() => setFamilyEntryMode('new')}
                >
                  <Text style={[styles.familySegmentButtonText, familyEntryMode === 'new' && styles.familySegmentButtonTextActive]}>Add New Person</Text>
                </Pressable>
              </View>

              <View style={styles.familyInputStack}>
                <TextInput
                  style={styles.familyInput}
                  placeholder={familyEntryMode === 'existing' ? 'Type name, phone or birth year' : 'Family member full name'}
                  placeholderTextColor="#9AA7A1"
                  value={familyFullName}
                  onChangeText={setFamilyFullName}
                />
                <TextInput
                  style={styles.familyInput}
                  placeholder="Phone (optional)"
                  placeholderTextColor="#9AA7A1"
                  value={familyPhoneNumber}
                  onChangeText={setFamilyPhoneNumber}
                />
                <TextInput
                  style={styles.familyInput}
                  placeholder="Birth year (optional)"
                  placeholderTextColor="#9AA7A1"
                  value={familyBirthYear}
                  keyboardType="number-pad"
                  onChangeText={(value) => setFamilyBirthYear(value.replace(/[^0-9]/g, ''))}
                />
              </View>
            </View>

            {familyEntryMode === 'new' ? (
              <>
                <Pressable style={styles.familyAdvancedToggle} onPress={() => setShowAdvancedFamilyFields((prev) => !prev)}>
                  <Text style={styles.familyAdvancedToggleText}>
                    {showAdvancedFamilyFields ? 'Hide extra details' : 'Add more details (optional)'}
                  </Text>
                </Pressable>

                {showAdvancedFamilyFields ? (
                  <>
                    <TextInput
                      style={styles.loginInput}
                      placeholder="Location (optional)"
                      placeholderTextColor="#9AA7A1"
                      value={familyLocation}
                      onChangeText={setFamilyLocation}
                    />
                    <TextInput
                      style={styles.loginInput}
                      placeholder="Email (optional)"
                      placeholderTextColor="#9AA7A1"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={familyEmail}
                      onChangeText={setFamilyEmail}
                    />
                    <TextInput
                      style={styles.loginInput}
                      placeholder="Gender (optional)"
                      placeholderTextColor="#9AA7A1"
                      value={familyGender}
                      onChangeText={setFamilyGender}
                    />
                    <TextInput
                      style={styles.loginInput}
                      placeholder="Photo URL (optional)"
                      placeholderTextColor="#9AA7A1"
                      autoCapitalize="none"
                      value={familyPhotoUrl}
                      onChangeText={setFamilyPhotoUrl}
                    />
                    <TextInput
                      style={styles.familyNotesInput}
                      placeholder="Notes (optional)"
                      placeholderTextColor="#9AA7A1"
                      multiline
                      numberOfLines={3}
                      value={familyNotes}
                      onChangeText={setFamilyNotes}
                    />
                  </>
                ) : null}
              </>
            ) : null}

            {familyEntryMode === 'existing' ? (
              <View style={styles.familyActionRow}>
                <Pressable style={[styles.familyActionButtonPrimary, isFamilySaving && styles.loginCtaButtonDisabled]} onPress={searchFamilySuggestions}>
                  <Text style={styles.profileSaveButtonText}>{isFamilySaving ? 'Please wait...' : 'Find Matches'}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.familyActionRow}>
                <Pressable style={[styles.familyActionButtonPrimary, isFamilySaving && styles.loginCtaButtonDisabled]} onPress={() => submitFamilyLink()}>
                  <Text style={styles.profileSaveButtonText}>{isFamilySaving ? 'Please wait...' : 'Save Family Member'}</Text>
                </Pressable>
                <Pressable style={[styles.familyActionButtonSecondary, isFamilySaving && styles.loginCtaButtonDisabled]} onPress={() => submitFamilyLink(undefined, true)}>
                  <Text style={styles.profileSaveButtonText}>{isFamilySaving ? 'Please wait...' : 'Force Create'}</Text>
                </Pressable>
              </View>
            )}

            {familySuggestions.length ? (
              <View>
                {familySuggestions.map((suggestion) => (
                  <View key={suggestion.id} style={styles.feedItem}>
                    <Text style={styles.feedTitle}>{suggestion.fullName}</Text>
                    <Text style={styles.feedBody}>
                      {suggestion.phoneNumber || 'No phone'} • {suggestion.birthYear || 'Unknown year'} • {suggestion.location || 'Unknown location'}
                    </Text>
                    <Pressable onPress={() => submitFamilyLink(suggestion.id)}>
                      <Text style={styles.familySuggestionLink}>This is the same person • Link</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {familyError ? <Text style={styles.profileErrorText}>{familyError}</Text> : null}
            {familyInfo ? <Text style={styles.profileInfoText}>{familyInfo}</Text> : null}
          </View>
        </ScreenShell>
      );
    }

    if (activeScreen === 'tree') {
      const primaryName = authUser?.fullName || currentMemberName;
      const treeData = buildFamilyTreeEngineData(primaryName, familyData);

      return (
        <ScreenShell
          title="Family Tree"
          activeScreen={activeScreen}
          memberName={currentMemberName}
          isProfileMenuOpen={isProfileMenuOpen}
          onNavigate={setActiveScreen}
          onToggleProfileMenu={() => setIsProfileMenuOpen((prev) => !prev)}
          onCloseProfileMenu={() => setIsProfileMenuOpen(false)}
          onSearch={handleSearchPress}
          onBack={() => setActiveScreen('home')}
          onLogout={handleLogout}
        >
          <View style={styles.treeStatsGrid}>
            <View style={styles.treeStatTile}>
              <Text style={styles.treeStatValue}>{dashboardData ? dashboardData.stats.membersCount : isDashboardLoading ? '...' : '--'}</Text>
              <Text style={styles.treeStatLabel}>Members</Text>
            </View>
            <View style={styles.treeStatTile}>
              <Text style={styles.treeStatValue}>{dashboardData ? dashboardData.stats.householdsCount : isDashboardLoading ? '...' : '--'}</Text>
              <Text style={styles.treeStatLabel}>Households</Text>
            </View>
          </View>

          {isFamilyLoading ? <Text>Loading family tree...</Text> : null}
          {familyError && !isFamilyLoading ? <Text>{familyError}</Text> : null}
          {!isFamilyLoading && !familyError ? (
            <FamilyTreeEngine
              data={treeData}
              onAddPress={(node) => {
                const matchedMember = [
                  ...(familyData?.ownParents ?? familyData?.parents ?? []),
                  ...(familyData?.spouseParents ?? []),
                  ...(familyData?.children ?? []),
                  ...(familyData?.siblings ?? []),
                  ...(familyData?.spouse ? [familyData.spouse] : [])
                ].find((member) => String(member.id) === node.id);

                const targetName = matchedMember?.fullName || node.name;
                const targetId = matchedMember?.id ?? null;

                setActiveScreen('profile');
                setFamilyRelationType(node.id === 'you' || targetId ? 'parent' : 'child');
                setFamilySourceMemberId(targetId);
                setFamilyEntryMode('new');
                setShowAdvancedFamilyFields(false);
                setFamilyInfo(`Add family for ${targetName}. Complete the form below.`);
                setFamilyError('');
              }}
            />
          ) : null}

          {familyInfo ? <Text style={styles.profileInfoText}>{familyInfo}</Text> : null}
        </ScreenShell>
      );
    }

    if (activeScreen === 'funeralCases') {
      return (
        <ScreenShell
          title="Funeral Cases"
          activeScreen={activeScreen}
          memberName={currentMemberName}
          isProfileMenuOpen={isProfileMenuOpen}
          onNavigate={setActiveScreen}
          onToggleProfileMenu={() => setIsProfileMenuOpen((prev) => !prev)}
          onCloseProfileMenu={() => setIsProfileMenuOpen(false)}
          onSearch={handleSearchPress}
          onBack={() => setActiveScreen('home')}
          onLogout={handleLogout}
        >
          {dashboardData?.funeralCases?.length ? (
            dashboardData.funeralCases.map((item) => (
              <InfoRow
                key={item.id}
                title={`${item.isActive ? 'Active' : 'Closed'} Case`}
                detail={`R${Math.round(item.contributionPerMember)}/member | Funeral: ${new Date(item.funeralDate).toLocaleDateString()} | ${item.funeralLocation}`}
              />
            ))
          ) : (
            <InfoRow
              title={isDashboardLoading ? 'Loading funeral cases...' : 'No funeral cases found'}
              detail={dashboardError ? dashboardError : 'When cases are created, they will appear here.'}
            />
          )}
        </ScreenShell>
      );
    }

    if (activeScreen === 'notifications') {
      return (
        <ScreenShell
          title="Notifications"
          activeScreen={activeScreen}
          memberName={currentMemberName}
          isProfileMenuOpen={isProfileMenuOpen}
          onNavigate={setActiveScreen}
          onToggleProfileMenu={() => setIsProfileMenuOpen((prev) => !prev)}
          onCloseProfileMenu={() => setIsProfileMenuOpen(false)}
          onSearch={handleSearchPress}
          onBack={() => setActiveScreen('home')}
          onLogout={handleLogout}
        >
          {dashboardData?.notifications?.length ? (
            dashboardData.notifications.map((item) => <InfoRow key={item.id} title={item.title} detail={item.message} />)
          ) : (
            <InfoRow
              title={isDashboardLoading ? 'Loading notifications...' : 'No notifications yet'}
              detail={dashboardError ? dashboardError : 'You are all caught up for now.'}
            />
          )}
        </ScreenShell>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TopBar
          memberName={currentMemberName}
          activeScreen={activeScreen}
          onNavigate={setActiveScreen}
          onSearch={handleSearchPress}
          isMenuOpen={isProfileMenuOpen}
          onToggleMenu={() => setIsProfileMenuOpen((prev) => !prev)}
          onCloseMenu={() => setIsProfileMenuOpen(false)}
          onLogout={handleLogout}
        />

        {isProfileMenuOpen ? <Pressable style={styles.screenTapOverlay} onPress={() => setIsProfileMenuOpen(false)} /> : null}

        <View style={styles.dashboardWelcomeCard}>
          <View style={styles.dashboardWelcomeTopRow}>
            <View style={styles.dashboardWelcomeHeading}>
              <Text style={styles.dashboardWelcomeKicker}>Ubuntu Roots</Text>
              <Text style={styles.dashboardWelcomeTitle} numberOfLines={2}>
                Welcome back, {currentMemberName}
              </Text>
            </View>
            <View style={styles.dashboardBadge}>
              <Text style={styles.dashboardBadgeText}>Family First</Text>
            </View>
          </View>
          <Text style={styles.dashboardWelcomeBody}>Track family support, events, and contributions in one trusted home.</Text>
        </View>

        <View style={styles.dashboardStatsRow}>
          <View style={styles.dashboardStatCard}>
            <Text style={styles.dashboardStatValue}>{dashboardData ? dashboardData.stats.membersCount : isDashboardLoading ? '...' : '--'}</Text>
            <Text style={styles.dashboardStatLabel}>Members</Text>
          </View>
          <View style={styles.dashboardStatCard}>
            <Text style={styles.dashboardStatValue}>{dashboardData ? dashboardData.stats.householdsCount : isDashboardLoading ? '...' : '--'}</Text>
            <Text style={styles.dashboardStatLabel}>Households</Text>
          </View>
          <View style={styles.dashboardStatCard}>
            <Text style={styles.dashboardStatValue}>{dashboardData ? dashboardData.stats.activeCasesCount : isDashboardLoading ? '...' : '--'}</Text>
            <Text style={styles.dashboardStatLabel}>Active Cases</Text>
          </View>
        </View>

        {dashboardError ? (
          <View style={styles.sectionCard}>
            <Text style={styles.profileErrorText}>{dashboardError}</Text>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable key={action.screen} style={styles.actionPill} onPress={() => setActiveScreen(action.screen)}>
                <Text style={styles.actionPillText}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Family Priorities</Text>
          <View style={styles.priorityRow}>
            <Text style={styles.priorityLabel}>Case Contributions</Text>
            <Text style={styles.priorityPercent}>{completionRate}%</Text>
          </View>
          <View style={styles.priorityBarTrack}>
            <View style={[styles.priorityBarFill, { width: `${completionRate}%` }]} />
          </View>

          <View style={styles.priorityRow}>
            <Text style={styles.priorityLabel}>Directory Completion</Text>
            <Text style={styles.priorityPercent}>{directoryCompletionRate}%</Text>
          </View>
          <View style={styles.priorityBarTrack}>
            <View style={[styles.priorityBarFillAlt, { width: `${directoryCompletionRate}%` }]} />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Upcoming Moments</Text>
          {dashboardData?.upcomingMoments?.length ? (
            dashboardData.upcomingMoments.map((moment) => (
              <View key={moment.id} style={styles.feedItem}>
                <Text style={styles.feedTitle}>{moment.title}</Text>
                <Text style={styles.feedBody}>{moment.detail}</Text>
              </View>
            ))
          ) : (
            <View style={styles.feedItem}>
              <Text style={styles.feedTitle}>{isDashboardLoading ? 'Loading moments...' : 'No upcoming moments yet'}</Text>
              <Text style={styles.feedBody}>When new events or cases are scheduled, they will appear here.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  })();

  if (!isAuthenticated) {
    if (showLanding) {
      const introOpacity = landingIntroAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
      const introTranslateY = landingIntroAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

      return (
        <SafeAreaView style={styles.landingScreen}>
          <View style={styles.loginGlowTop} />
          <LandingBackground />
          <View style={styles.landingContentWrap}>
            <Animated.View style={[styles.landingLogoRow, { opacity: introOpacity, transform: [{ translateY: introTranslateY }] }]}>
              <View style={styles.topNavBrandBadge}>
                <Text style={styles.topNavBrandBadgeText}>UR</Text>
              </View>
              <Text style={styles.landingTitle}>Ubuntu Roots</Text>
            </Animated.View>

            <Animated.View style={[styles.landingHeroWrap, { opacity: introOpacity, transform: [{ translateY: introTranslateY }] }]}>
              <Text style={styles.landingTagline}>Our Family. Our Strength.</Text>
              <Text style={styles.landingHeadline}>Your family’s trusted support hub.</Text>
              <Text style={styles.landingSubcopy}>
                Manage members, contributions, and important updates securely — with clarity and peace of mind.
              </Text>
            </Animated.View>

            <Animated.View style={[styles.landingCtaWrap, { opacity: introOpacity, transform: [{ translateY: introTranslateY }] }]}>
              <Pressable
                style={styles.landingPrimaryCta}
                onPress={() => {
                  setAuthMode('signup');
                  setAuthError('');
                  setAuthInfo('');
                  setShowLanding(false);
                }}
              >
                <Text style={styles.landingPrimaryCtaText}>Get started</Text>
              </Pressable>

              <Pressable
                style={styles.landingSecondaryCta}
                onPress={() => {
                  setAuthMode('login');
                  setAuthError('');
                  setAuthInfo('');
                  setShowLanding(false);
                }}
              >
                <Text style={styles.landingSecondaryCtaText}>Sign in</Text>
              </Pressable>
            </Animated.View>
          </View>
          <StatusBar style="light" />
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.loginScreen}>
        <View style={styles.loginGlowTop} />
        <View style={styles.loginGlowBottom} />
        <View style={styles.loginCard}>
          <View style={styles.loginIconWrap}>
            <View style={styles.logoTreeWrap}>
              <View style={styles.logoCanopyLarge} />
              <View style={styles.logoCanopyLeft} />
              <View style={styles.logoCanopyRight} />
              <View style={styles.logoTrunk} />
              <View style={styles.logoRootRow}>
                <View style={[styles.logoRoot, styles.logoRootFarLeft]} />
                <View style={[styles.logoRoot, styles.logoRootLeft]} />
                <View style={[styles.logoRoot, styles.logoRootCenter]} />
                <View style={[styles.logoRoot, styles.logoRootRight]} />
                <View style={[styles.logoRoot, styles.logoRootFarRight]} />
              </View>
            </View>
          </View>
          <Text style={styles.loginTitle}>Ubuntu Roots</Text>
          <Text style={styles.loginSubtitle}>Create your account first, then login securely.</Text>

          <View style={styles.loginForm}>
            {authMode === 'signup' ? (
              <>
                <TextInput
                  style={styles.loginInput}
                  placeholder="First Name"
                  placeholderTextColor="#9AA7A1"
                  value={firstName}
                  onChangeText={setFirstName}
                />
                <TextInput
                  style={styles.loginInput}
                  placeholder="Surname"
                  placeholderTextColor="#9AA7A1"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </>
            ) : null}
            <TextInput
              style={styles.loginInput}
              placeholder="Email Address"
              placeholderTextColor="#9AA7A1"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <View style={styles.passwordFieldWrap}>
              <TextInput
                style={styles.passwordFieldInput}
                placeholder="Password"
                placeholderTextColor="#9AA7A1"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable style={styles.passwordToggleButton} onPress={() => setShowPassword((prev) => !prev)}>
                <Text style={styles.passwordToggleText}>{showPassword ? '🙈' : '👁️'}</Text>
              </Pressable>
            </View>

            {authMode === 'signup' ? (
              <View style={styles.passwordFieldWrap}>
                <TextInput
                  style={styles.passwordFieldInput}
                  placeholder="Confirm Password"
                  placeholderTextColor="#9AA7A1"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <Pressable style={styles.passwordToggleButton} onPress={() => setShowConfirmPassword((prev) => !prev)}>
                  <Text style={styles.passwordToggleText}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {authError ? <Text style={styles.loginErrorText}>{authError}</Text> : null}
          {authInfo ? <Text style={styles.loginInfoText}>{authInfo}</Text> : null}

          <Pressable
            style={[styles.loginCtaButton, isSubmitting && styles.loginCtaButtonDisabled]}
            onPress={handleAuthSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.loginCtaButtonText}>
              {isSubmitting ? 'Please wait...' : authMode === 'signup' ? 'Create account' : 'Login'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.loginModeSwitchButton}
            onPress={() => {
              setAuthMode(authMode === 'signup' ? 'login' : 'signup');
              setAuthError('');
              setAuthInfo('');
              setFirstName('');
              setLastName('');
              setPassword('');
              setConfirmPassword('');
            }}
          >
            <Text style={styles.loginModeSwitchText}>
              {authMode === 'signup' ? 'Already have an account? Login' : 'New here? Create an account'}
            </Text>
          </Pressable>

          <Pressable style={styles.loginBackToLandingButton} onPress={() => setShowLanding(true)}>
            <Text style={styles.loginBackToLandingText}>Back</Text>
          </Pressable>
        </View>
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appContentWrap}>{content}</View>
      <BottomNav
        activeScreen={activeScreen}
        onNavigate={(screen) => {
          setIsProfileMenuOpen(false);
          setActiveScreen(screen);
        }}
      />
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

function ScreenShell({
  title,
  activeScreen,
  memberName,
  isProfileMenuOpen,
  onNavigate,
  onToggleProfileMenu,
  onCloseProfileMenu,
  onSearch,
  onBack,
  onLogout,
  children
}: {
  title: string;
  activeScreen: ScreenKey;
  memberName: string;
  isProfileMenuOpen: boolean;
  onNavigate: (screen: ScreenKey) => void;
  onToggleProfileMenu: () => void;
  onCloseProfileMenu: () => void;
  onSearch: () => void;
  onBack: () => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <TopBar
        memberName={memberName}
        activeScreen={activeScreen}
        onNavigate={onNavigate}
        onSearch={onSearch}
        isMenuOpen={isProfileMenuOpen}
        onToggleMenu={onToggleProfileMenu}
        onCloseMenu={onCloseProfileMenu}
        onLogout={onLogout}
      />
      {isProfileMenuOpen ? <Pressable style={styles.screenTapOverlay} onPress={onCloseProfileMenu} /> : null}
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>
      <View style={styles.sectionCard}>
        <Text style={styles.screenTitle}>{title}</Text>
        {children}
      </View>
    </ScrollView>
  );
}

function BottomNav({
  activeScreen,
  onNavigate
}: {
  activeScreen: ScreenKey;
  onNavigate: (screen: ScreenKey) => void;
}) {
  return (
    <View style={styles.bottomNavWrap}>
      {BOTTOM_NAV_ITEMS.map((item) => {
        const isActive = activeScreen === item.screen;

        return (
          <Pressable
            key={item.screen}
            style={[styles.bottomNavItem, isActive && styles.bottomNavItemActive]}
            onPress={() => onNavigate(item.screen)}
          >
            <Text style={styles.bottomNavIcon}>{item.icon}</Text>
            <Text style={[styles.bottomNavLabel, isActive && styles.bottomNavLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function InfoRow({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.feedItem}>
      <Text style={styles.feedTitle}>{title}</Text>
      <Text style={styles.feedBody}>{detail}</Text>
    </View>
  );
}

function TopBar({
  memberName,
  activeScreen,
  onNavigate,
  onSearch,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onLogout
}: {
  memberName: string;
  activeScreen: ScreenKey;
  onNavigate: (screen: ScreenKey) => void;
  onSearch: () => void;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onLogout: () => void;
}) {
  const memberInitial = memberName.charAt(0).toUpperCase() || 'M';

  return (
    <View style={styles.topNavCard}>
      <View style={styles.topNavMainRow}>
        <View style={styles.topNavBrandWrap}>
          <View style={styles.topNavBrandBadge}>
            <Text style={styles.topNavBrandBadgeText}>UR</Text>
          </View>
          <View>
            <Text style={styles.topNavTitle}>Ubuntu Roots</Text>
          </View>
        </View>
        <View style={styles.topNavActionsRow}>
          <Pressable
            style={styles.topNavSearchButton}
            onPress={() => {
              onCloseMenu();
              onSearch();
            }}
          >
            <Text style={styles.topNavSearchIcon}>🔎</Text>
          </Pressable>

          <Pressable
            style={styles.topNavNotificationButton}
            onPress={() => {
              onCloseMenu();
              onNavigate('notifications');
            }}
          >
            <Text style={styles.topNavNotificationIcon}>🔔</Text>
            <View style={styles.topNavNotificationDot} />
          </Pressable>

          <Pressable style={styles.topNavProfileTrigger} onPress={onToggleMenu}>
            <View style={styles.topNavAvatar}>
              <Text style={styles.topNavAvatarText}>{memberInitial}</Text>
            </View>
          </Pressable>

          {isMenuOpen ? (
            <View style={styles.topNavMenu}>
              <Pressable
                style={styles.topNavMenuItem}
                onPress={() => {
                  onCloseMenu();
                  onNavigate('profile');
                }}
              >
                <Text style={styles.topNavMenuText}>Settings</Text>
              </Pressable>
              <Pressable
                style={styles.topNavMenuItem}
                onPress={() => {
                  onCloseMenu();
                  onLogout();
                }}
              >
                <Text style={styles.topNavMenuText}>Logout</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#174E3B'
  },
  appContentWrap: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 14
  },
  screenTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2
  },
  bottomNavWrap: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#245E49',
    borderTopWidth: 1,
    borderTopColor: '#3C7A64',
    paddingVertical: 8,
    paddingBottom: 12
  },
  bottomNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    minWidth: 62,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 2
  },
  bottomNavItemActive: {
    backgroundColor: '#D8B85C'
  },
  bottomNavIcon: {
    fontSize: 16
  },
  bottomNavLabel: {
    color: '#EAF4EF',
    fontSize: 10,
    fontWeight: '700'
  },
  bottomNavLabelActive: {
    color: '#1F5F46'
  },
  topNavCard: {
    backgroundColor: '#245E49',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10
  },
  topNavMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  topNavBrandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  topNavBrandBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#D8B85C',
    justifyContent: 'center',
    alignItems: 'center'
  },
  topNavBrandBadgeText: {
    color: '#1F5F46',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  topNavTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  topNavMeta: {
    marginTop: 2,
    color: '#CFE2D9',
    fontSize: 12,
    fontWeight: '600'
  },
  topNavActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'relative'
  },
  topNavSearchButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2E7058',
    justifyContent: 'center',
    alignItems: 'center'
  },
  topNavSearchIcon: {
    fontSize: 15
  },
  topNavNotificationButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2E7058',
    justifyContent: 'center',
    alignItems: 'center'
  },
  topNavNotificationIcon: {
    fontSize: 15
  },
  topNavNotificationDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F26672'
  },
  topNavProfileTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2E7058',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  topNavAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D8B85C',
    justifyContent: 'center',
    alignItems: 'center'
  },
  topNavAvatarText: {
    color: '#1F5F46',
    fontSize: 11,
    fontWeight: '800'
  },
  topNavMemberName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  topNavRole: {
    color: '#D8B85C',
    fontSize: 10,
    fontWeight: '700'
  },
  topNavMenu: {
    position: 'absolute',
    top: 42,
    right: 0,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2ECE8',
    zIndex: 5
  },
  topNavMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  topNavMenuText: {
    color: '#1F5F46',
    fontSize: 13,
    fontWeight: '700'
  },
  topNavTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  topNavTab: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#2D6E56'
  },
  topNavTabActive: {
    backgroundColor: '#D8B85C'
  },
  topNavTabText: {
    color: '#E4EFEA',
    fontSize: 12,
    fontWeight: '700'
  },
  topNavTabTextActive: {
    color: '#1F5F46'
  },
  loginScreen: {
    flex: 1,
    backgroundColor: '#165A46',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  landingScreen: {
    flex: 1,
    backgroundColor: '#165A46',
    paddingHorizontal: 20
  },
  loginGlowTop: {
    position: 'absolute',
    top: -140,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(126, 212, 175, 0.22)'
  },
  loginGlowBottom: {
    position: 'absolute',
    bottom: -150,
    left: -95,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(74, 173, 134, 0.24)'
  },
  loginCard: {
    width: '94%',
    maxWidth: 350,
    borderRadius: 34,
    backgroundColor: '#2DA777',
    paddingHorizontal: 22,
    paddingTop: 42,
    paddingBottom: 34,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7DEC7'
  },
  landingContentWrap: {
    flex: 1,
    paddingTop: 28,
    paddingBottom: 28,
    zIndex: 1
  },
  landingBg: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0
  },
  landingBgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#165A46'
  },
  landingBgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.18)'
  },
  landingBgCircleA: {
    position: 'absolute',
    top: -120,
    left: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(216, 184, 92, 0.18)'
  },
  landingBgCircleB: {
    position: 'absolute',
    top: 120,
    right: -140,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(126, 212, 175, 0.16)'
  },
  landingBgCircleC: {
    position: 'absolute',
    bottom: -190,
    left: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(45, 167, 119, 0.22)'
  },
  landingBgRootLine: {
    position: 'absolute',
    bottom: 140,
    left: 26,
    width: 3,
    height: 170,
    borderRadius: 2,
    backgroundColor: 'rgba(233, 253, 245, 0.12)'
  },
  landingBgRootLine2: {
    position: 'absolute',
    bottom: 80,
    left: 70,
    width: 2,
    height: 150,
    borderRadius: 2,
    backgroundColor: 'rgba(233, 253, 245, 0.1)',
    transform: [{ rotate: '-12deg' }]
  },
  loginIconWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2,
    borderColor: 'rgba(233, 253, 245, 0.45)',
    backgroundColor: 'rgba(24, 102, 72, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  logoTreeWrap: {
    width: 50,
    height: 52,
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  logoCanopyLarge: {
    width: 30,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E9FDF5'
  },
  logoCanopyLeft: {
    position: 'absolute',
    top: 7,
    left: 6,
    width: 16,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E9FDF5'
  },
  logoCanopyRight: {
    position: 'absolute',
    top: 7,
    right: 6,
    width: 16,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E9FDF5'
  },
  logoTrunk: {
    marginTop: 4,
    width: 7,
    height: 15,
    borderRadius: 4,
    backgroundColor: '#E9FDF5'
  },
  logoRootRow: {
    marginTop: 4,
    width: 44,
    height: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  logoRoot: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E9FDF5'
  },
  logoRootFarLeft: {
    width: 9,
    transform: [{ rotate: '-42deg' }]
  },
  logoRootLeft: {
    width: 8,
    transform: [{ rotate: '-22deg' }]
  },
  logoRootCenter: {
    width: 10
  },
  logoRootRight: {
    width: 8,
    transform: [{ rotate: '22deg' }]
  },
  logoRootFarRight: {
    width: 9,
    transform: [{ rotate: '42deg' }]
  },
  loginTitle: {
    marginTop: 14,
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800'
  },
  loginSubtitle: {
    marginTop: 8,
    textAlign: 'center',
    color: '#D8F2E6',
    fontSize: 13,
    lineHeight: 19
  },
  loginForm: {
    width: '100%',
    marginTop: 26,
    gap: 12
  },
  loginInput: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
    color: '#1F5F46',
    fontSize: 14,
    fontWeight: '600'
  },
  familyNotesInput: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: '#1F5F46',
    fontSize: 14,
    fontWeight: '600',
    minHeight: 86,
    textAlignVertical: 'top'
  },
  passwordFieldWrap: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center'
  },
  passwordFieldInput: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingLeft: 18,
    paddingRight: 52,
    paddingVertical: 11,
    color: '#1F5F46',
    fontSize: 14,
    fontWeight: '600'
  },
  passwordToggleButton: {
    position: 'absolute',
    right: 12,
    paddingHorizontal: 6,
    paddingVertical: 4
  },
  passwordToggleText: {
    fontSize: 16
  },
  loginCtaButton: {
    marginTop: 20,
    width: '100%',
    backgroundColor: '#F26672',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center'
  },
  loginCtaButtonDisabled: {
    opacity: 0.65
  },
  loginCtaButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  loginErrorText: {
    marginTop: 12,
    color: '#FFE0E3',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center'
  },
  loginInfoText: {
    marginTop: 12,
    color: '#EBFFF6',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center'
  },
  loginModeSwitchButton: {
    marginTop: 16,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  loginModeSwitchText: {
    color: '#F2FFFA',
    fontSize: 12,
    fontWeight: '700'
  },
  loginBackToLandingButton: {
    marginTop: 10,
    alignItems: 'center'
  },
  loginBackToLandingText: {
    color: '#D8B85C',
    fontSize: 13,
    fontWeight: '800'
  },
  landingLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  landingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900'
  },
  landingHeroWrap: {
    marginTop: 26,
    flex: 1,
    justifyContent: 'center'
  },
  landingTagline: {
    color: '#D8B85C',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase'
  },
  landingHeadline: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28
  },
  landingSubcopy: {
    marginTop: 10,
    color: '#D7E9E1',
    fontSize: 13,
    lineHeight: 19
  },
  landingCtaWrap: {
    width: '100%'
  },
  landingPrimaryCta: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#D8B85C'
  },
  landingPrimaryCtaText: {
    color: '#1F5F46',
    fontSize: 14,
    fontWeight: '900'
  },
  landingSecondaryCta: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)'
  },
  landingSecondaryCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  },
  profileFormWrap: {
    marginTop: 6,
    backgroundColor: '#E8F0EC',
    borderRadius: 14,
    padding: 14
  },
  profileFormLabel: {
    marginBottom: 10,
    color: '#1F5F46',
    fontSize: 14,
    fontWeight: '800'
  },
  familyBuilderCard: {
    backgroundColor: '#F4F8F6',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6E5DE',
    padding: 12
  },
  familyHelperText: {
    marginBottom: 12,
    color: '#4D655B',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600'
  },
  familyStepLabel: {
    marginTop: 2,
    marginBottom: 8,
    color: '#1F5F46',
    fontSize: 12,
    fontWeight: '800'
  },
  familyRelationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  familyRelationPill: {
    width: '48.7%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1E2DA',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center'
  },
  familyRelationPillActive: {
    backgroundColor: '#1F6A4D',
    borderColor: '#1F6A4D'
  },
  familyRelationPillText: {
    color: '#1F5F46',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center'
  },
  familyRelationPillTextActive: {
    color: '#FFFFFF'
  },
  familyInlineHint: {
    marginTop: 8,
    marginBottom: 12,
    color: '#60776D',
    fontSize: 11,
    fontWeight: '600'
  },
  familySegmentRow: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: '#E8F0EC',
    padding: 4,
    gap: 6,
    marginBottom: 10
  },
  familySegmentButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  familySegmentButtonActive: {
    backgroundColor: '#245E49'
  },
  familySegmentButtonText: {
    color: '#366353',
    fontSize: 12,
    fontWeight: '800'
  },
  familySegmentButtonTextActive: {
    color: '#FFFFFF'
  },
  familyInputStack: {
    gap: 8
  },
  familyInput: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D4E2DB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#1F5F46',
    fontSize: 14,
    fontWeight: '600'
  },
  familyModeSwitchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  familyModeButton: {
    flex: 1,
    backgroundColor: '#E8F0EC',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8
  },
  familyModeButtonActive: {
    backgroundColor: '#245E49'
  },
  familyAdvancedToggle: {
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CFE0D8',
    backgroundColor: '#F4F8F6',
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  familyAdvancedToggleText: {
    color: '#1F5F46',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center'
  },
  profileErrorText: {
    marginTop: 10,
    color: '#9F2730',
    fontSize: 12,
    fontWeight: '700'
  },
  profileInfoText: {
    marginTop: 10,
    color: '#1F5F46',
    fontSize: 12,
    fontWeight: '700'
  },
  profileSaveButton: {
    marginTop: 12,
    alignItems: 'center',
    backgroundColor: '#245E49',
    borderRadius: 10,
    paddingVertical: 10
  },
  familyActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12
  },
  familyActionButtonPrimary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#245E49',
    borderRadius: 10,
    paddingVertical: 11
  },
  familyActionButtonSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#315F50',
    borderRadius: 10,
    paddingVertical: 11
  },
  profileSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  dashboardWelcomeCard: {
    backgroundColor: '#245E49',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#3B7B63'
  },
  dashboardWelcomeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10
  },
  dashboardWelcomeHeading: {
    flex: 1,
    minWidth: 0
  },
  dashboardWelcomeKicker: {
    color: '#B9D8CB',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  dashboardWelcomeTitle: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800'
  },
  dashboardBadge: {
    backgroundColor: '#D8B85C',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start'
  },
  dashboardBadgeText: {
    color: '#1F5F46',
    fontSize: 11,
    fontWeight: '800'
  },
  dashboardWelcomeBody: {
    marginTop: 10,
    color: '#D4E9DF',
    fontSize: 13,
    lineHeight: 19
  },
  dashboardStatsRow: {
    flexDirection: 'row',
    gap: 10
  },
  dashboardStatCard: {
    flex: 1,
    backgroundColor: '#245E49',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#3B7B63'
  },
  dashboardStatValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800'
  },
  dashboardStatLabel: {
    marginTop: 2,
    color: '#B7D0C4',
    fontSize: 12,
    fontWeight: '600'
  },
  priorityRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  priorityLabel: {
    color: '#315F50',
    fontSize: 13,
    fontWeight: '700'
  },
  priorityPercent: {
    color: '#1F5F46',
    fontSize: 12,
    fontWeight: '800'
  },
  priorityBarTrack: {
    marginTop: 6,
    height: 9,
    borderRadius: 999,
    backgroundColor: '#DBE8E2',
    overflow: 'hidden'
  },
  priorityBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2AA16E'
  },
  priorityBarFillAlt: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#1F5F46'
  },
  hero: {
    paddingTop: 4,
    paddingBottom: 10
  },
  kicker: {
    color: '#BBD8CA',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontWeight: '700'
  },
  heroTitle: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800'
  },
  heroSubtitle: {
    marginTop: 2,
    color: '#D8B85C',
    fontSize: 22,
    fontWeight: '700'
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10
  },
  statCard: {
    flex: 1,
    backgroundColor: '#245E49',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800'
  },
  statLabel: {
    marginTop: 2,
    color: '#B7D0C4',
    fontSize: 12,
    fontWeight: '600'
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F5F46',
    marginBottom: 10
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F5F46',
    marginBottom: 12
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#245E49',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  actionPill: {
    width: '48.5%',
    backgroundColor: '#E8F0EC',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10
  },
  actionPillText: {
    color: '#1F5F46',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center'
  },
  familyRelationButtonActive: {
    backgroundColor: '#245E49'
  },
  familyRelationButtonTextActive: {
    color: '#FFFFFF'
  },
  feedItem: {
    backgroundColor: '#F5F7F6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8
  },
  feedTitle: {
    color: '#1F5F46',
    fontSize: 14,
    fontWeight: '700'
  },
  feedBody: {
    marginTop: 3,
    color: '#53645D',
    fontSize: 13,
    lineHeight: 18
  },
  familySuggestionLink: {
    marginTop: 6,
    color: '#1F5F46',
    fontSize: 13,
    fontWeight: '800'
  },
  treeStatsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10
  },
  treeStatTile: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#EEF5F1',
    borderWidth: 1,
    borderColor: '#D4E3DB',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  treeStatValue: {
    color: '#184E3B',
    fontSize: 20,
    fontWeight: '800'
  },
  treeStatLabel: {
    marginTop: 2,
    color: '#4B6B5D',
    fontSize: 12,
    fontWeight: '700'
  },
  treePanel: {
    backgroundColor: '#F4F7F5',
    borderRadius: 14,
    padding: 16
  },
  treeCanvas: {
    minWidth: 900,
    alignItems: 'center',
    gap: 40,
    paddingVertical: 20
  },
  treeLevel: {
    alignItems: 'center'
  },
  treeLevelLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
    color: '#355E52'
  },
  treeRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  treeCoupleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    minHeight: 150
  },
  treeTopParentGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 58,
    marginBottom: -4,
    minHeight: 146
  },
  treeTopParentColumn: {
    width: 170,
    alignItems: 'center'
  },
  treeTopParentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center'
  },
  treeTopJoinWrap: {
    alignItems: 'center',
    marginTop: 2
  },
  treeTopJoinHorizontal: {
    width: 126,
    height: 2,
    backgroundColor: '#BFCBD5',
    borderRadius: 999
  },
  treeTopConnectorLine: {
    marginTop: 0,
    width: 2,
    height: 50,
    backgroundColor: '#BFCBD5'
  },
  treeCoupleLine: {
    width: 42,
    height: 2,
    backgroundColor: '#BFCBD5',
    marginTop: 26
  },
  treeNodeWrap: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 2
  },
  treeParentActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2
  },
  treeParentActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D4E1DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  treeParentActionText: {
    color: '#355E52',
    fontSize: 10,
    fontWeight: '800'
  },
  treeNodeCard: {
    width: 150,
    minHeight: 70,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6E3DC',
    padding: 10,
    alignItems: 'center'
  },
  treeNodeAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E7F1EC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6
  },
  treeNodeAvatarText: {
    fontWeight: '800',
    color: '#2C5244'
  },
  treeNodeName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center'
  },
  treeNodeMeta: {
    marginTop: 2,
    color: '#5E766D',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center'
  },
  treeNodeAddButton: {
    position: 'absolute',
    bottom: -10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4E1DB',
    alignItems: 'center',
    justifyContent: 'center'
  },
  treeNodeAddButtonText: {
    fontWeight: '900'
  },
  treeConnectorWrap: {
    alignItems: 'center'
  },
  treeConnectorLine: {
    width: 2,
    height: 40,
    backgroundColor: '#BFCBD5'
  }
});
