import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Image,
  TextInput,
  Modal
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Live Supabase Production Cluster: cqevzpvyqvckvenutuzz
const DEFAULT_SUPABASE_URL = 'https://cqevzpvyqvckvenutuzz.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_vFIWyBN1E22I-7saEe3Yew_vV2fQkUX';

// Master HQ Geofence Coordinates (Vedotrix Innovation Park, Bengaluru)
const OFFICE_COORDS = {
  latitude: 12.9352,
  longitude: 77.6946,
  radiusMeters: 200
};

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function generateOfferSerial(orgCode: string = 'VDX'): string {
  const year = new Date().getFullYear();
  const hex = Math.random().toString(16).substring(2, 8).toUpperCase();
  const cleanCode = (orgCode || 'VDX').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 4);
  return `VDX-${cleanCode}-${year}-${hex}`;
}

export default function App() {
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userProfile, setUserProfile] = useState<any>(null);

  // Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Active Bottom Navigation Tab
  const [activeTab, setActiveTab] = useState<'punch' | 'org' | 'offers' | 'tasks' | 'requests'>('punch');

  // GPS Attendance State
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState<boolean>(false);

  // Multi-Tenant Organizations State
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [currentOrg, setCurrentOrg] = useState<any>(null);
  const [isOrgModalVisible, setIsOrgModalVisible] = useState(false);
  const [isOnboardModalVisible, setIsOnboardModalVisible] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCode, setNewOrgCode] = useState('');
  const [newOrgIndustry, setNewOrgIndustry] = useState('Tech');
  const [newOrgWebsite, setNewOrgWebsite] = useState('https://');

  // Team Profiles & Hierarchy
  const [teamProfiles, setTeamProfiles] = useState<any[]>([]);
  const [isAddEmployeeModal, setIsAddEmployeeModal] = useState(false);
  const [newEmpFirst, setNewEmpFirst] = useState('');
  const [newEmpLast, setNewEmpLast] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('employee');
  const [newEmpDesig, setNewEmpDesig] = useState('');
  const [newEmpDept, setNewEmpDept] = useState('Engineering');
  const [newEmpManagerId, setNewEmpManagerId] = useState('');

  // Offer Letters State
  const [offerLetters, setOfferLetters] = useState<any[]>([]);
  const [isNewOfferModal, setIsNewOfferModal] = useState(false);
  const [candName, setCandName] = useState('');
  const [candEmail, setCandEmail] = useState('');
  const [candDesig, setCandDesig] = useState('');
  const [candCtc, setCandCtc] = useState('1200000');
  const [verifyQuery, setVerifyQuery] = useState('');
  const [verifyResult, setVerifyResult] = useState<any>(null);

  // Attendance Regularization State
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [isRegModal, setIsRegModal] = useState(false);
  const [regCategory, setRegCategory] = useState('Client On-Site Visit');
  const [regJustification, setRegJustification] = useState('');

  // Tasks & Standups State
  const [tasks, setTasks] = useState<any[]>([]);
  const [standups, setStandups] = useState<any[]>([]);
  const [isStandupModal, setIsStandupModal] = useState(false);
  const [completedToday, setCompletedToday] = useState('');
  const [plannedTomorrow, setPlannedTomorrow] = useState('');
  const [blockers, setBlockers] = useState('');
  const [hoursLogged, setHoursLogged] = useState('8');

  // Access Requests State
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [targetModule, setTargetModule] = useState<string>('tech_sprints');
  const [justification, setJustification] = useState<string>('');
  const [isSubmittingReq, setIsSubmittingReq] = useState<boolean>(false);

  useEffect(() => {
    initSupabase();
  }, []);

  const initSupabase = async () => {
    try {
      const client = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);
      setSupabaseClient(client);

      const { data: orgData, error } = await client.from('organizations').select('*');
      if (!error && orgData && orgData.length > 0) {
        setSupabaseConnected(true);
        setOrganizations(orgData);
        setCurrentOrg(orgData[0]);
      }
      checkSession(client);
    } catch (e) {
      console.log('Supabase init error', e);
    }
  };

  const checkSession = async (client: SupabaseClient) => {
    try {
      const token = await AsyncStorage.getItem('@vdx_mobile_token');
      const email = await AsyncStorage.getItem('@vdx_mobile_email');
      const savedProfile = await AsyncStorage.getItem('@vdx_user_profile');

      if (token && email && savedProfile) {
        const parsed = JSON.parse(savedProfile);
        setUserEmail(email);
        setUserProfile(parsed);
        setIsLoggedIn(true);
        loadSavedPunch();
        requestLocationPermission();
        refreshAllData(client, parsed.org_id, parsed.user_id);
      }
    } catch (e) {
      console.log('Session check error', e);
    }
  };

  const refreshAllData = async (client: SupabaseClient, orgId?: string, profileId?: string) => {
    const targetOrgId = orgId || currentOrg?.id || userProfile?.org_id;
    if (!client) return;

    try {
      // 1. Organizations
      const { data: orgs } = await client.from('organizations').select('*');
      if (orgs) {
        setOrganizations(orgs);
        if (targetOrgId) {
          const match = orgs.find((o) => o.id === targetOrgId);
          if (match) setCurrentOrg(match);
        }
      }

      // 2. Team Profiles for Org
      if (targetOrgId) {
        const { data: profiles } = await client
          .from('profiles')
          .select('*')
          .eq('org_id', targetOrgId);
        if (profiles) setTeamProfiles(profiles);
      }

      // 3. Offer Letters
      if (targetOrgId) {
        const { data: offers } = await client
          .from('offer_letters')
          .select('*')
          .eq('org_id', targetOrgId)
          .order('created_at', { ascending: false });
        if (offers) setOfferLetters(offers);
      }

      // 4. Attendance Records
      if (targetOrgId) {
        const { data: att } = await client
          .from('attendance')
          .select('*')
          .eq('org_id', targetOrgId)
          .order('date', { ascending: false });
        if (att) setAttendanceRecords(att);
      }

      // 5. Tasks
      if (targetOrgId) {
        const { data: t } = await client
          .from('tasks')
          .select('*')
          .eq('org_id', targetOrgId);
        if (t) setTasks(t);
      }

      // 6. Standups
      if (targetOrgId) {
        const { data: st } = await client
          .from('standups')
          .select('*')
          .eq('org_id', targetOrgId)
          .order('date', { ascending: false });
        if (st) setStandups(st);
      }

      // 7. Access Requests
      const { data: reqs } = await client
        .from('access_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (reqs) setAccessRequests(reqs);
    } catch (err) {
      console.log('Error refreshing data:', err);
    }
  };

  // Bcrypt RPC Authentication
  const handleMobileLogin = async () => {
    if (!loginEmail.trim() || !loginPass.trim()) {
      Alert.alert('Required', 'Please enter both work email and security password.');
      return;
    }

    setIsAuthenticating(true);
    const clean = loginEmail.trim().toLowerCase();
    const cleanPass = loginPass.trim();

    if (supabaseClient) {
      try {
        const { data: rpcData, error } = await supabaseClient.rpc('verify_user_password', {
          user_email: clean,
          input_password: cleanPass
        });

        if (error) {
          Alert.alert('Authentication Error', error.message || 'Verification failed.');
          setIsAuthenticating(false);
          return;
        }

        if (rpcData && rpcData.length > 0 && rpcData[0].is_valid === true) {
          const user = rpcData[0];
          await AsyncStorage.setItem('@vdx_mobile_token', `vdx_m_${Date.now()}`);
          await AsyncStorage.setItem('@vdx_mobile_email', clean);
          await AsyncStorage.setItem('@vdx_user_profile', JSON.stringify(user));

          setUserEmail(clean);
          setUserProfile(user);
          setIsLoggedIn(true);
          loadSavedPunch();
          requestLocationPermission();
          refreshAllData(supabaseClient, user.org_id, user.user_id);

          Alert.alert('Welcome Back', `Logged in as ${user.first_name} ${user.last_name} (${user.role.toUpperCase()})`);
        } else {
          Alert.alert('Access Denied', 'Invalid work email or password.');
        }
      } catch (err: any) {
        Alert.alert('Connection Error', err?.message || 'Could not verify credentials.');
      }
    }
    setIsAuthenticating(false);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('@vdx_mobile_token');
    await AsyncStorage.removeItem('@vdx_mobile_email');
    await AsyncStorage.removeItem('@vdx_user_profile');
    setIsLoggedIn(false);
    setUserEmail('');
    setUserProfile(null);
    setIsCheckedIn(false);
  };

  const loadSavedPunch = async () => {
    try {
      const savedIn = await AsyncStorage.getItem('@vdx_punch_time');
      if (savedIn) {
        setIsCheckedIn(true);
        setCheckInTime(savedIn);
      }
    } catch (e) {
      console.log('Storage error', e);
    }
  };

  const requestLocationPermission = async () => {
    setLocLoading(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'GPS permission is needed for geo-fencing.');
      setLocLoading(false);
      return;
    }

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      setLocation(loc);

      const dist = getDistanceMeters(
        loc.coords.latitude,
        loc.coords.longitude,
        OFFICE_COORDS.latitude,
        OFFICE_COORDS.longitude
      );
      setDistance(dist);
    } catch (e) {
      console.log('Location error', e);
    } finally {
      setLocLoading(false);
    }
  };

  const handlePunchToggle = async () => {
    const isInsideFence = distance !== null && distance <= OFFICE_COORDS.radiusMeters;
    const nowTime = new Date().toLocaleTimeString();

    if (!isCheckedIn) {
      setIsCheckedIn(true);
      setCheckInTime(nowTime);
      await AsyncStorage.setItem('@vdx_punch_time', nowTime);

      if (supabaseClient && supabaseConnected) {
        try {
          await supabaseClient.from('attendance').insert({
            profile_id: userProfile?.user_id,
            org_id: currentOrg?.id || userProfile?.org_id,
            date: new Date().toISOString().split('T')[0],
            check_in_time: new Date().toISOString(),
            check_in_lat: location?.coords.latitude,
            check_in_long: location?.coords.longitude,
            distance_meters: distance,
            status: isInsideFence ? 'present' : 'absent',
            is_remote: !isInsideFence
          });
        } catch (e) {}
      }

      Alert.alert(
        'Punch In Recorded 📍',
        `Checked in at ${nowTime}. Geofence: ${isInsideFence ? 'In Office' : 'Remote'}`
      );
    } else {
      setIsCheckedIn(false);
      setCheckInTime(null);
      await AsyncStorage.removeItem('@vdx_punch_time');
      Alert.alert('Punch Out Recorded 🏁', 'Daily attendance saved. Please submit your EOD standup.');
    }
  };

  // Submit Attendance Regularization Request
  const handleSubmitRegularization = async () => {
    if (!regJustification.trim()) {
      Alert.alert('Required', 'Please enter a justification.');
      return;
    }
    if (!supabaseClient || !userProfile) return;

    try {
      const { error } = await supabaseClient.from('attendance').insert({
        profile_id: userProfile.user_id,
        org_id: currentOrg?.id || userProfile.org_id,
        date: new Date().toISOString().split('T')[0],
        check_in_time: new Date().toISOString(),
        status: 'present',
        regularization_status: 'pending',
        regularization_reason: `${regCategory}: ${regJustification.trim()}`,
        is_remote: true
      });

      if (!error) {
        Alert.alert('Request Sent ⏳', 'Regularization submitted for manager approval.');
        setIsRegModal(false);
        setRegJustification('');
        if (supabaseClient) refreshAllData(supabaseClient);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    }
  };

  // Resolve Regularization (HR / Manager)
  const handleResolveRegularization = async (id: string, status: 'approved' | 'rejected') => {
    if (!supabaseClient) return;
    try {
      const { error } = await supabaseClient
        .from('attendance')
        .update({ regularization_status: status })
        .eq('id', id);

      if (!error) {
        Alert.alert('Regularization Updated', `Status marked as ${status}.`);
        refreshAllData(supabaseClient);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    }
  };

  // Onboard New Organization (Superadmin)
  const handleOnboardOrg = async () => {
    if (!newOrgName.trim() || !newOrgCode.trim()) {
      Alert.alert('Required', 'Please provide organization name and 3-4 character code.');
      return;
    }
    if (!supabaseClient) return;

    try {
      const { data, error } = await supabaseClient.from('organizations').insert({
        name: newOrgName.trim(),
        slug: newOrgName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        org_code: newOrgCode.trim().toUpperCase(),
        industry: newOrgIndustry,
        website: newOrgWebsite.trim(),
        status: 'active',
        subscription_plan: 'Professional'
      }).select();

      if (!error && data) {
        Alert.alert('Organization Registered 🏢', `${newOrgName} is now active on Vedotrix.`);
        setIsOnboardModalVisible(false);
        setNewOrgName('');
        setNewOrgCode('');
        refreshAllData(supabaseClient);
      } else {
        Alert.alert('Error', error?.message || 'Could not onboard organization.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    }
  };

  // Add Employee Profile (HR / Owner / Superadmin)
  const handleAddEmployee = async () => {
    if (!newEmpFirst.trim() || !newEmpEmail.trim() || !newEmpDesig.trim()) {
      Alert.alert('Required', 'Please enter first name, work email, and designation.');
      return;
    }
    if (!supabaseClient || !currentOrg) return;

    try {
      const { error } = await supabaseClient.from('profiles').insert({
        org_id: currentOrg.id,
        first_name: newEmpFirst.trim(),
        last_name: newEmpLast.trim() || 'Team',
        email: newEmpEmail.trim().toLowerCase(),
        role: newEmpRole,
        designation: newEmpDesig.trim(),
        department: newEmpDept,
        manager_id: newEmpManagerId || null
      });

      if (!error) {
        Alert.alert('Team Member Added 👤', `${newEmpFirst} has been registered to ${currentOrg.name}.`);
        setIsAddEmployeeModal(false);
        setNewEmpFirst('');
        setNewEmpLast('');
        setNewEmpEmail('');
        setNewEmpDesig('');
        refreshAllData(supabaseClient);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    }
  };

  // Issue New Offer Letter (HR / Owner)
  const handleCreateOffer = async () => {
    if (!candName.trim() || !candEmail.trim() || !candDesig.trim()) {
      Alert.alert('Required', 'Candidate name, email, and designation are required.');
      return;
    }
    if (!supabaseClient || !currentOrg) return;

    const annualCtcNum = Number(candCtc) || 1200000;
    const monthlyTotal = Math.round(annualCtcNum / 12);
    const basicMonthly = Math.round(monthlyTotal * 0.5);
    const hraMonthly = Math.round(monthlyTotal * 0.25);
    const specialAllowance = monthlyTotal - (basicMonthly + hraMonthly);
    const serialNumber = generateOfferSerial(currentOrg.org_code);

    try {
      const { error } = await supabaseClient.from('offer_letters').insert({
        org_id: currentOrg.id,
        serial_number: serialNumber,
        candidate_name: candName.trim(),
        candidate_email: candEmail.trim().toLowerCase(),
        candidate_phone: '+91 9876543210',
        designation: candDesig.trim(),
        department: 'Engineering',
        annual_ctc: annualCtcNum,
        basic_monthly: basicMonthly,
        hra_monthly: hraMonthly,
        special_allowance: specialAllowance,
        joining_date: '2026-10-15',
        status: 'issued',
        verification_token: `vdx_${Date.now()}_sha256`,
        issued_by: userProfile?.user_id || 'hr_manager'
      });

      if (!error) {
        Alert.alert(
          'Offer Letter Issued 📜',
          `Generated Cryptographic Serial: ${serialNumber}`
        );
        setIsNewOfferModal(false);
        setCandName('');
        setCandEmail('');
        setCandDesig('');
        refreshAllData(supabaseClient);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    }
  };

  // Verify Serial Number
  const handleVerifySerial = () => {
    if (!verifyQuery.trim()) return;
    const clean = verifyQuery.trim().toUpperCase();
    const found = offerLetters.find((o) => o.serial_number?.toUpperCase() === clean);
    if (found) {
      setVerifyResult(found);
    } else {
      setVerifyResult('NOT_FOUND');
    }
  };

  // Submit Daily EOD Standup
  const handleSubmitStandup = async () => {
    if (!completedToday.trim() || !plannedTomorrow.trim()) {
      Alert.alert('Required', 'Please complete today accomplishments and tomorrow priorities.');
      return;
    }
    if (!supabaseClient || !userProfile) return;

    try {
      const { error } = await supabaseClient.from('standups').insert({
        employee_id: userProfile.user_id,
        org_id: currentOrg?.id || userProfile.org_id,
        date: new Date().toISOString().split('T')[0],
        completed_today: completedToday.trim(),
        planned_tomorrow: plannedTomorrow.trim(),
        blockers: blockers.trim() || null,
        hours_logged: Number(hoursLogged) || 8
      });

      if (!error) {
        Alert.alert('EOD Standup Submitted 🚀', 'Your end-of-day progress is saved to cloud.');
        setIsStandupModal(false);
        setCompletedToday('');
        setPlannedTomorrow('');
        setBlockers('');
        refreshAllData(supabaseClient);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    }
  };

  // Submit Access Request (Hierarchy-Aware)
  const handleSubmitAccessRequest = async () => {
    if (!justification.trim()) {
      Alert.alert('Required', 'Please explain your business justification.');
      return;
    }
    if (!supabaseClient || !userProfile) return;

    setIsSubmittingReq(true);
    try {
      const { error } = await supabaseClient.from('access_requests').insert({
        org_id: currentOrg?.id || userProfile.org_id,
        requester_id: userProfile.user_id,
        request_type: 'module_access',
        target_module: targetModule,
        justification: justification.trim(),
        status: 'pending',
        assigned_approver_id: userProfile.manager_id || null
      });

      if (!error) {
        Alert.alert(
          'Request Submitted 🎯',
          userProfile.manager_id
            ? 'Your request has been routed to your designated reporting manager.'
            : 'Submitted to organization administrator for review.'
        );
        setJustification('');
        refreshAllData(supabaseClient);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    } finally {
      setIsSubmittingReq(false);
    }
  };

  // Manager Approval / Rejection for Access Requests
  const handleResolveRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    if (!supabaseClient || !userProfile) return;
    try {
      const { error } = await supabaseClient
        .from('access_requests')
        .update({
          status,
          approver_decision_notes: `${status === 'approved' ? 'Approved' : 'Rejected'} via Vedotrix Mobile App by ${userProfile.first_name} ${userProfile.last_name}`,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (!error) {
        Alert.alert('Status Updated', `Request has been marked as ${status}.`);
        refreshAllData(supabaseClient);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    }
  };

  const isInside = distance !== null && distance <= OFFICE_COORDS.radiusMeters;
  const isSuperadmin = userProfile?.role === 'superadmin';
  const isOwnerOrHR = userProfile?.role === 'owner' || userProfile?.role === 'hr' || isSuperadmin;

  // Filter pending regularizations
  const pendingRegularizations = attendanceRecords.filter((a) => a.regularization_status === 'pending');

  // Filter incoming approvals for access requests
  const incomingApprovals = accessRequests.filter(
    (r) =>
      r.status === 'pending' &&
      (r.assigned_approver_id === userProfile?.user_id ||
        (userProfile?.role === 'owner' && r.org_id === (currentOrg?.id || userProfile?.org_id)) ||
        isSuperadmin)
  );

  // 1. LOGIN SCREEN VIEW
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#07090e" />
        <View style={styles.loginCard}>
          <Image source={require('./assets/icon.png')} style={styles.loginLogo} resizeMode="contain" />
          <Text style={styles.loginTitle}>Vedotrix Pulse</Text>
          <Text style={styles.loginSubtitle}>Multi-Tenant Enterprise HRMS & Mobile Suite</Text>
          <Text style={styles.loginBrand}>Designed & Managed by Vedotrix Technologies</Text>

          <Text style={styles.inputLabel}>Work Email Address</Text>
          <TextInput
            style={styles.textInput}
            value={loginEmail}
            onChangeText={setLoginEmail}
            placeholder="name@company.com"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.inputLabel}>Security Password</Text>
          <TextInput
            style={styles.textInput}
            value={loginPass}
            onChangeText={setLoginPass}
            placeholder="••••••••••••"
            placeholderTextColor="#64748b"
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity style={styles.loginBtn} onPress={handleMobileLogin} disabled={isAuthenticating}>
            <Text style={styles.loginBtnText}>{isAuthenticating ? 'Authenticating...' : 'Secure Mobile Log In'}</Text>
          </TouchableOpacity>

          <View style={styles.badgeRow}>
            <Text style={styles.secText}>🛡️ Supabase Live</Text>
            <Text style={styles.secText}>•</Text>
            <Text style={styles.secText}>🔒 Bcrypt Hashed</Text>
            <Text style={styles.secText}>•</Text>
            <Text style={styles.secText}>🔐 SSL Multi-Tenant</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 2. MAIN LOGGED-IN SCREEN VIEW
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07090e" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={require('./assets/icon.png')} style={styles.logoImage} resizeMode="contain" />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.brandTitle}>
                Vedotrix <Text style={styles.brandAccent}>Pulse</Text>
              </Text>
              {isSuperadmin && (
                <View style={styles.superBadge}>
                  <Text style={styles.superBadgeText}>SUPER</Text>
                </View>
              )}
            </View>
            <Text style={styles.brandSubtitle} numberOfLines={1}>
              {currentOrg ? currentOrg.name : 'Organization'} • {userProfile?.role?.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {isSuperadmin && (
            <TouchableOpacity style={styles.switchOrgBtn} onPress={() => setIsOrgModalVisible(true)}>
              <Text style={styles.switchOrgBtnText}>🏢 Switch</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content Body */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Organization Banner */}
        {currentOrg && (
          <View style={styles.orgBanner}>
            <View style={styles.orgBannerHeader}>
              <View>
                <Text style={styles.orgNameText}>{currentOrg.name}</Text>
                <Text style={styles.orgMetaText}>
                  Code: <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>{currentOrg.org_code}</Text> • {currentOrg.industry} • Plan: {currentOrg.subscription_plan || 'Pro'}
                </Text>
              </View>
              <View style={styles.activeTag}>
                <Text style={styles.activeTagText}>LIVE</Text>
              </View>
            </View>
          </View>
        )}

        {/* 1. GPS PUNCH TAB */}
        {activeTab === 'punch' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Geo-Fenced Smart Punch</Text>
            <Text style={styles.cardDesc}>
              Vedotrix HQ Geofence (Radius: {OFFICE_COORDS.radiusMeters}m)
            </Text>

            <View style={[styles.statusBadge, isInside ? styles.statusBadgeInside : styles.statusBadgeRemote]}>
              <Text style={[styles.statusText, isInside ? styles.statusTextInside : styles.statusTextRemote]}>
                {isInside ? '● INSIDE GEOFENCE' : '▲ REMOTE LOCATION'}
              </Text>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Distance to Office</Text>
                <Text style={styles.metricValue}>
                  {distance !== null ? `${distance} m` : '--'}
                </Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>GPS Status</Text>
                <Text style={styles.metricValue}>
                  {locLoading ? 'Locating...' : location ? 'High Accuracy' : 'GPS Offline'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.punchButton, isCheckedIn ? styles.punchButtonOut : styles.punchButtonIn]}
              onPress={handlePunchToggle}
            >
              <Text style={styles.punchButtonText}>
                {isCheckedIn ? 'PUNCH OUT' : 'PUNCH IN (CHECK-IN)'}
              </Text>
              {checkInTime && (
                <Text style={styles.punchTimeText}>Checked in at: {checkInTime}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.refreshButton} onPress={requestLocationPermission}>
              <Text style={styles.refreshButtonText}>↻ Refresh GPS Coordinates</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.standupButton, { marginTop: 12 }]}
              onPress={() => setIsRegModal(true)}
            >
              <Text style={styles.standupButtonText}>✍️ Request Attendance Regularization</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 2. HR & ORGANIZATIONS HUB TAB */}
        {activeTab === 'org' && (
          <View style={{ gap: 14 }}>
            {/* Superadmin Tenant Management */}
            {isSuperadmin && (
              <View style={[styles.card, { borderColor: '#38bdf8' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.cardTitle, { color: '#38bdf8' }]}>Client Organizations ({organizations.length})</Text>
                  <TouchableOpacity
                    style={styles.smallAddBtn}
                    onPress={() => setIsOnboardModalVisible(true)}
                  >
                    <Text style={styles.smallAddBtnText}>+ Onboard Org</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.cardDesc}>Master root controller across all organizations</Text>

                {organizations.map((org) => (
                  <TouchableOpacity
                    key={org.id}
                    style={[
                      styles.orgRowItem,
                      currentOrg?.id === org.id && styles.orgRowItemActive
                    ]}
                    onPress={() => setCurrentOrg(org)}
                  >
                    <View>
                      <Text style={styles.orgRowTitle}>{org.name}</Text>
                      <Text style={styles.orgRowSub}>
                        Code: {org.org_code} • {org.industry} • {org.subscription_plan}
                      </Text>
                    </View>
                    {currentOrg?.id === org.id && (
                      <Text style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: 11 }}>Active Tenant</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Team & Employee Directory */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.cardTitle}>Team Directory ({teamProfiles.length})</Text>
                {isOwnerOrHR && (
                  <TouchableOpacity
                    style={styles.smallAddBtn}
                    onPress={() => setIsAddEmployeeModal(true)}
                  >
                    <Text style={styles.smallAddBtnText}>+ Add Member</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.cardDesc}>
                Employee hierarchy & designation map for {currentOrg?.name}
              </Text>

              {teamProfiles.length === 0 ? (
                <Text style={styles.emptyTaskText}>No team profiles found for this organization.</Text>
              ) : (
                teamProfiles.map((member) => {
                  const manager = teamProfiles.find((p) => p.id === member.manager_id);
                  return (
                    <View key={member.id} style={styles.teamCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.teamName}>
                          {member.first_name} {member.last_name}
                        </Text>
                        <View style={styles.rolePill}>
                          <Text style={styles.rolePillText}>{member.role?.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={styles.teamDesig}>
                        {member.designation} • {member.department}
                      </Text>
                      <Text style={styles.teamEmail}>{member.email}</Text>
                      {manager && (
                        <Text style={styles.teamManager}>
                          Reporting Lead: {manager.first_name} {manager.last_name}
                        </Text>
                      )}
                    </View>
                  );
                })
              )}
            </View>

            {/* Attendance Regularization Approval Queue for HR/Managers */}
            {isOwnerOrHR && pendingRegularizations.length > 0 && (
              <View style={[styles.card, { borderColor: '#f59e0b' }]}>
                <Text style={[styles.cardTitle, { color: '#fbbf24' }]}>
                  Pending Regularizations ({pendingRegularizations.length})
                </Text>
                <Text style={styles.cardDesc}>Requests awaiting HR / managerial sign-off</Text>

                {pendingRegularizations.map((reg) => {
                  const emp = teamProfiles.find((p) => p.id === reg.profile_id);
                  return (
                    <View key={reg.id} style={styles.regApprovalCard}>
                      <Text style={styles.regEmpName}>
                        {emp ? `${emp.first_name} ${emp.last_name}` : 'Team Member'}
                      </Text>
                      <Text style={styles.regReason}>"{reg.regularization_reason}"</Text>
                      <Text style={styles.regDate}>Date: {reg.date}</Text>

                      <View style={styles.btnRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.approveBtn]}
                          onPress={() => handleResolveRegularization(reg.id, 'approved')}
                        >
                          <Text style={styles.btnText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.rejectBtn]}
                          onPress={() => handleResolveRegularization(reg.id, 'rejected')}
                        >
                          <Text style={styles.btnText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* 3. OFFERS & PAYROLL TAB */}
        {activeTab === 'offers' && (
          <View style={{ gap: 14 }}>
            {/* Offer Letters Section */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.cardTitle}>Offer Letters ({offerLetters.length})</Text>
                {isOwnerOrHR && (
                  <TouchableOpacity
                    style={styles.smallAddBtn}
                    onPress={() => setIsNewOfferModal(true)}
                  >
                    <Text style={styles.smallAddBtnText}>+ Issue Offer</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.cardDesc}>
                Anti-fraud cryptographic letterhead with verifiable serials
              </Text>

              {/* Verify Serial Inline Input */}
              <View style={styles.verifyBox}>
                <Text style={styles.verifyBoxTitle}>🔍 In-App Anti-Fraud Serial Verification</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  <TextInput
                    style={[styles.textInput, { flex: 1, textTransform: 'uppercase' }]}
                    value={verifyQuery}
                    onChangeText={setVerifyQuery}
                    placeholder="e.g. VDX-NEX-2026-A109F2"
                    placeholderTextColor="#64748b"
                  />
                  <TouchableOpacity style={styles.verifyActionBtn} onPress={handleVerifySerial}>
                    <Text style={styles.verifyActionBtnText}>Verify</Text>
                  </TouchableOpacity>
                </View>

                {verifyResult && verifyResult !== 'NOT_FOUND' && (
                  <View style={styles.verifySuccess}>
                    <Text style={styles.verifySuccessTitle}>✅ GENUINE & AUTHENTIC</Text>
                    <Text style={styles.verifySuccessSub}>
                      Candidate: {verifyResult.candidate_name} ({verifyResult.designation})
                    </Text>
                    <Text style={styles.verifySuccessSerial}>Serial: {verifyResult.serial_number}</Text>
                  </View>
                )}
                {verifyResult === 'NOT_FOUND' && (
                  <View style={styles.verifyFail}>
                    <Text style={styles.verifyFailText}>❌ SERIAL RECORD NOT FOUND</Text>
                  </View>
                )}
              </View>

              {offerLetters.map((offer) => (
                <View key={offer.id} style={styles.offerCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.offerCandidate}>{offer.candidate_name}</Text>
                    <View style={styles.offerStatusPill}>
                      <Text style={styles.offerStatusText}>{offer.status?.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.offerDesig}>{offer.designation} • {offer.department}</Text>
                  <Text style={styles.offerSerial}>Serial: {offer.serial_number}</Text>
                  <Text style={styles.offerCtc}>Fixed CTC: ₹{(Number(offer.annual_ctc) || 0).toLocaleString('en-IN')}</Text>
                </View>
              ))}
            </View>

            {/* Compensation & Payroll Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>My Compensation & Payroll</Text>
              <Text style={styles.cardDesc}>Tax-compliant salary structure & monthly payout</Text>

              <View style={styles.payGrid}>
                <View style={styles.payItem}>
                  <Text style={styles.payLabel}>Annual Fixed CTC</Text>
                  <Text style={styles.payVal}>₹12,00,000</Text>
                </View>
                <View style={styles.payItem}>
                  <Text style={styles.payLabel}>Monthly Basic (50%)</Text>
                  <Text style={styles.payVal}>₹50,000</Text>
                </View>
                <View style={styles.payItem}>
                  <Text style={styles.payLabel}>HRA (25%)</Text>
                  <Text style={styles.payVal}>₹25,000</Text>
                </View>
                <View style={styles.payItem}>
                  <Text style={styles.payLabel}>Special Allowance</Text>
                  <Text style={styles.payVal}>₹25,000</Text>
                </View>
              </View>

              <View style={styles.netBox}>
                <Text style={styles.netLabel}>Estimated Net Take-Home / Month</Text>
                <Text style={styles.netVal}>₹93,200</Text>
              </View>
            </View>
          </View>
        )}

        {/* 4. TASKS & EOD STANDUPS TAB */}
        {activeTab === 'tasks' && (
          <View style={{ gap: 14 }}>
            {/* Active Sprint Tasks */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sprint Tasks ({tasks.length})</Text>
              <Text style={styles.cardDesc}>Current deliverables & Git feature branches</Text>

              {tasks.length === 0 ? (
                <Text style={styles.emptyTaskText}>No active sprint tasks recorded.</Text>
              ) : (
                tasks.map((task) => (
                  <View key={task.id} style={styles.taskCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      <Text style={styles.taskPriority}>{task.priority?.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.taskDesc}>{task.description}</Text>
                    <Text style={styles.taskStatus}>Status: {task.status}</Text>
                  </View>
                ))
              )}

              <TouchableOpacity
                style={styles.standupButton}
                onPress={() => setIsStandupModal(true)}
              >
                <Text style={styles.standupButtonText}>Submit Daily EOD Standup</Text>
              </TouchableOpacity>
            </View>

            {/* Daily Standups Feed */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Daily Team Standups ({standups.length})</Text>
              <Text style={styles.cardDesc}>Accountability & roadblock detection</Text>

              {standups.map((s) => {
                const emp = teamProfiles.find((p) => p.id === s.employee_id);
                return (
                  <View key={s.id} style={styles.standupFeedItem}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.standupAuthor}>
                        {emp ? `${emp.first_name} ${emp.last_name}` : 'Team Member'}
                      </Text>
                      <Text style={styles.standupDate}>{s.date} • {s.hours_logged} hrs</Text>
                    </View>
                    <Text style={styles.standupText}>
                      <Text style={{ color: '#10b981', fontWeight: 'bold' }}>Done: </Text>
                      {s.completed_today}
                    </Text>
                    <Text style={styles.standupText}>
                      <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>Next: </Text>
                      {s.planned_tomorrow}
                    </Text>
                    {s.blockers && (
                      <Text style={[styles.standupText, { color: '#f59e0b' }]}>
                        ⚠️ Blocker: {s.blockers}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 5. ACCESS REQUESTS & HIERARCHY APPROVALS TAB */}
        {activeTab === 'requests' && (
          <View style={{ gap: 14 }}>
            {/* Incoming Approvals Queue for Managers */}
            {incomingApprovals.length > 0 && (
              <View style={[styles.card, { borderColor: '#0284c7' }]}>
                <Text style={[styles.cardTitle, { color: '#38bdf8' }]}>
                  ⚡ Designated Approvals Queue ({incomingApprovals.length})
                </Text>
                <Text style={styles.cardDesc}>
                  Requests assigned to you based on reporting hierarchy
                </Text>

                {incomingApprovals.map((req) => (
                  <View key={req.id} style={styles.reqCard}>
                    <Text style={styles.reqTitle}>Module: {req.target_module?.toUpperCase()}</Text>
                    <Text style={styles.reqBody}>"{req.justification}"</Text>
                    <Text style={styles.reqMeta}>Submitted: {new Date(req.created_at).toLocaleDateString()}</Text>

                    <View style={styles.btnRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.approveBtn]}
                        onPress={() => handleResolveRequest(req.id, 'approved')}
                      >
                        <Text style={styles.btnText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.rejectBtn]}
                        onPress={() => handleResolveRequest(req.id, 'rejected')}
                      >
                        <Text style={styles.btnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Submit Request Form */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Request Module Access</Text>
              <Text style={styles.cardDesc}>
                Requests route directly to your designated reporting manager
              </Text>

              <Text style={styles.inputLabel}>Select Module / Permission</Text>
              <View style={styles.moduleSelector}>
                {[
                  { id: 'tech_sprints', label: 'Tech Sprints & Git' },
                  { id: 'offers', label: 'Offer Letters & Verification' },
                  { id: 'payroll', label: 'Payroll & Disbursals' },
                  { id: 'geo_override', label: 'Remote Geo Punch' },
                  { id: 'admin_console', label: 'Admin Settings' }
                ].map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.modOption, targetModule === m.id && styles.modOptionActive]}
                    onPress={() => setTargetModule(m.id)}
                  >
                    <Text style={[styles.modOptionText, targetModule === m.id && styles.modOptionTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Business Justification</Text>
              <TextInput
                style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                value={justification}
                onChangeText={setJustification}
                placeholder="Explain why you require this capability..."
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={styles.submitReqBtn}
                onPress={handleSubmitAccessRequest}
                disabled={isSubmittingReq}
              >
                <Text style={styles.submitReqBtnText}>
                  {isSubmittingReq ? 'Routing...' : 'Submit Request to Manager'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modern Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'punch' && styles.navItemActive]}
          onPress={() => setActiveTab('punch')}
        >
          <Text style={styles.navIcon}>📍</Text>
          <Text style={[styles.navLabel, activeTab === 'punch' && styles.navLabelActive]}>Punch</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'org' && styles.navItemActive]}
          onPress={() => setActiveTab('org')}
        >
          <Text style={styles.navIcon}>🏢</Text>
          <Text style={[styles.navLabel, activeTab === 'org' && styles.navLabelActive]}>HR & Org</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'offers' && styles.navItemActive]}
          onPress={() => setActiveTab('offers')}
        >
          <Text style={styles.navIcon}>📜</Text>
          <Text style={[styles.navLabel, activeTab === 'offers' && styles.navLabelActive]}>Offers & Pay</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'tasks' && styles.navItemActive]}
          onPress={() => setActiveTab('tasks')}
        >
          <Text style={styles.navIcon}>📋</Text>
          <Text style={[styles.navLabel, activeTab === 'tasks' && styles.navLabelActive]}>Tasks</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'requests' && styles.navItemActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={styles.navIcon}>⚡</Text>
          <Text style={[styles.navLabel, activeTab === 'requests' && styles.navLabelActive]}>
            Access {incomingApprovals.length > 0 ? `(${incomingApprovals.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal: Switch Organization */}
      <Modal visible={isOrgModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Switch Organization</Text>
            <Text style={styles.modalSub}>Select active tenant context</Text>

            <ScrollView style={{ maxHeight: 280, width: '100%', marginVertical: 10 }}>
              {organizations.map((org) => (
                <TouchableOpacity
                  key={org.id}
                  style={[
                    styles.orgSelectItem,
                    currentOrg?.id === org.id && styles.orgSelectItemActive
                  ]}
                  onPress={() => {
                    setCurrentOrg(org);
                    setIsOrgModalVisible(false);
                    if (supabaseClient) refreshAllData(supabaseClient, org.id);
                  }}
                >
                  <Text style={styles.orgSelectName}>{org.name}</Text>
                  <Text style={styles.orgSelectCode}>{org.org_code} • {org.industry}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsOrgModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Onboard New Organization */}
      <Modal visible={isOnboardModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Onboard Client Organization</Text>
            <Text style={styles.modalSub}>Creates new tenant in live Supabase</Text>

            <Text style={styles.inputLabel}>Company Name *</Text>
            <TextInput
              style={styles.textInput}
              value={newOrgName}
              onChangeText={setNewOrgName}
              placeholder="e.g. Apex Global Technologies"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>Organization Code (3-4 chars) *</Text>
            <TextInput
              style={[styles.textInput, { textTransform: 'uppercase' }]}
              value={newOrgCode}
              maxLength={4}
              onChangeText={(t) => setNewOrgCode(t.toUpperCase())}
              placeholder="e.g. APX"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>Industry Type</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 4 }}>
              {['Tech', 'Digital Marketing', 'Hybrid'].map((ind) => (
                <TouchableOpacity
                  key={ind}
                  style={[styles.indPill, newOrgIndustry === ind && styles.indPillActive]}
                  onPress={() => setNewOrgIndustry(ind)}
                >
                  <Text style={[styles.indPillText, newOrgIndustry === ind && styles.indPillTextActive]}>{ind}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.loginBtn} onPress={handleOnboardOrg}>
              <Text style={styles.loginBtnText}>Register Organization</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsOnboardModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Add Employee */}
      <Modal visible={isAddEmployeeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Team Member</Text>
            <Text style={styles.modalSub}>Assign to {currentOrg?.name}</Text>

            <Text style={styles.inputLabel}>First Name *</Text>
            <TextInput
              style={styles.textInput}
              value={newEmpFirst}
              onChangeText={setNewEmpFirst}
              placeholder="e.g. Priya"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>Last Name</Text>
            <TextInput
              style={styles.textInput}
              value={newEmpLast}
              onChangeText={setNewEmpLast}
              placeholder="e.g. Sharma"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>Work Email *</Text>
            <TextInput
              style={styles.textInput}
              value={newEmpEmail}
              onChangeText={setNewEmpEmail}
              placeholder="name@company.com"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Designation *</Text>
            <TextInput
              style={styles.textInput}
              value={newEmpDesig}
              onChangeText={setNewEmpDesig}
              placeholder="e.g. Senior Frontend Engineer"
              placeholderTextColor="#64748b"
            />

            <TouchableOpacity style={styles.loginBtn} onPress={handleAddEmployee}>
              <Text style={styles.loginBtnText}>Create Employee Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsAddEmployeeModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Issue Offer Letter */}
      <Modal visible={isNewOfferModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Issue Official Offer Letter</Text>
            <Text style={styles.modalSub}>Auto-generates cryptographic serial</Text>

            <Text style={styles.inputLabel}>Candidate Full Name *</Text>
            <TextInput
              style={styles.textInput}
              value={candName}
              onChangeText={setCandName}
              placeholder="e.g. Rahul Verma"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>Candidate Email *</Text>
            <TextInput
              style={styles.textInput}
              value={candEmail}
              onChangeText={setCandEmail}
              placeholder="rahul@example.com"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.inputLabel}>Designation *</Text>
            <TextInput
              style={styles.textInput}
              value={candDesig}
              onChangeText={setCandDesig}
              placeholder="e.g. Growth Lead"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>Annual Fixed CTC (₹ INR)</Text>
            <TextInput
              style={styles.textInput}
              value={candCtc}
              onChangeText={setCandCtc}
              placeholder="1200000"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
            />

            <TouchableOpacity style={styles.loginBtn} onPress={handleCreateOffer}>
              <Text style={styles.loginBtnText}>Issue Cryptographic Offer</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsNewOfferModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Request Attendance Regularization */}
      <Modal visible={isRegModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Attendance Regularization</Text>
            <Text style={styles.modalSub}>Submit justification to manager</Text>

            <Text style={styles.inputLabel}>Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
              {['Client On-Site Visit', 'Approved WFH', 'Missed Punch', 'Network Glitch'].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.indPill, regCategory === c && styles.indPillActive]}
                  onPress={() => setRegCategory(c)}
                >
                  <Text style={[styles.indPillText, regCategory === c && styles.indPillTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Detailed Justification *</Text>
            <TextInput
              style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
              value={regJustification}
              onChangeText={setRegJustification}
              placeholder="Explain field visit or reason..."
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={styles.loginBtn} onPress={handleSubmitRegularization}>
              <Text style={styles.loginBtnText}>Submit Regularization</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsRegModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Submit Daily Standup */}
      <Modal visible={isStandupModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Daily EOD Standup</Text>
            <Text style={styles.modalSub}>Accountability check-in for {currentOrg?.name}</Text>

            <Text style={styles.inputLabel}>1. What did you accomplish today? *</Text>
            <TextInput
              style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
              value={completedToday}
              onChangeText={setCompletedToday}
              placeholder="e.g. Deployed mobile HRMS update & fixed geofence sync"
              placeholderTextColor="#64748b"
              multiline
            />

            <Text style={styles.inputLabel}>2. Key priorities for tomorrow? *</Text>
            <TextInput
              style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
              value={plannedTomorrow}
              onChangeText={setPlannedTomorrow}
              placeholder="e.g. Client offer letter validation tests"
              placeholderTextColor="#64748b"
              multiline
            />

            <Text style={styles.inputLabel}>3. Blockers / Dependencies</Text>
            <TextInput
              style={styles.textInput}
              value={blockers}
              onChangeText={setBlockers}
              placeholder="e.g. Waiting for AWS credentials"
              placeholderTextColor="#64748b"
            />

            <TouchableOpacity style={styles.loginBtn} onPress={handleSubmitStandup}>
              <Text style={styles.loginBtnText}>Submit Standup Log</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsStandupModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07090e'
  },
  loginContainer: {
    flex: 1,
    backgroundColor: '#07090e',
    justifyContent: 'center',
    padding: 20
  },
  loginCard: {
    backgroundColor: '#0d121d',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center'
  },
  loginLogo: {
    width: 60,
    height: 60,
    borderRadius: 16,
    marginBottom: 10
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff'
  },
  loginSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    textAlign: 'center'
  },
  loginBrand: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38bdf8',
    marginTop: 4,
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
    alignSelf: 'flex-start',
    marginBottom: 5,
    marginTop: 8
  },
  textInput: {
    width: '100%',
    backgroundColor: '#07090e',
    borderColor: '#1e293b',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#ffffff',
    fontSize: 12
  },
  loginBtn: {
    width: '100%',
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    alignItems: 'center'
  },
  secText: {
    color: '#64748b',
    fontSize: 9
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 8
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff'
  },
  brandAccent: {
    color: '#38bdf8'
  },
  brandSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
    maxWidth: 160
  },
  superBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)'
  },
  superBadgeText: {
    fontSize: 8,
    color: '#38bdf8',
    fontWeight: 'bold'
  },
  switchOrgBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  switchOrgBtnText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold'
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)'
  },
  logoutBtnText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: 'bold'
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 80
  },
  orgBanner: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 12
  },
  orgBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  orgNameText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  orgMetaText: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2
  },
  activeTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)'
  },
  activeTagText: {
    color: '#34d399',
    fontSize: 9,
    fontWeight: 'bold'
  },
  card: {
    backgroundColor: '#0d121d',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff'
  },
  cardDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12
  },
  statusBadge: {
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 8
  },
  statusBadgeInside: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  statusBadgeRemote: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)'
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold'
  },
  statusTextInside: {
    color: '#34d399'
  },
  statusTextRemote: {
    color: '#fbbf24'
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 10
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#07090e',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  metricLabel: {
    fontSize: 9,
    color: '#64748b'
  },
  metricValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#38bdf8',
    marginTop: 2
  },
  punchButton: {
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    marginVertical: 6
  },
  punchButtonIn: {
    backgroundColor: '#0284c7'
  },
  punchButtonOut: {
    backgroundColor: '#dc2626'
  },
  punchButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  punchTimeText: {
    color: '#e2e8f0',
    fontSize: 10,
    marginTop: 3
  },
  refreshButton: {
    paddingVertical: 8,
    alignItems: 'center'
  },
  refreshButtonText: {
    color: '#64748b',
    fontSize: 11
  },
  standupButton: {
    backgroundColor: '#1e1b4b',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3730a3'
  },
  standupButtonText: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: 'bold'
  },
  smallAddBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  smallAddBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold'
  },
  orgRowItem: {
    backgroundColor: '#07090e',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8
  },
  orgRowItemActive: {
    borderColor: '#38bdf8',
    backgroundColor: '#0f172a'
  },
  orgRowTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  orgRowSub: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2
  },
  teamCard: {
    backgroundColor: '#07090e',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 8
  },
  teamName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  rolePill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  rolePillText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: 'bold'
  },
  teamDesig: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2
  },
  teamEmail: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 1
  },
  teamManager: {
    color: '#f59e0b',
    fontSize: 9,
    marginTop: 2
  },
  regApprovalCard: {
    backgroundColor: '#07090e',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 8
  },
  regEmpName: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold'
  },
  regReason: {
    color: '#fbbf24',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2
  },
  regDate: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 2
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center'
  },
  approveBtn: {
    backgroundColor: '#059669'
  },
  rejectBtn: {
    backgroundColor: '#dc2626'
  },
  btnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold'
  },
  verifyBox: {
    backgroundColor: '#07090e',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 10
  },
  verifyBoxTitle: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold'
  },
  verifyActionBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 10
  },
  verifyActionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold'
  },
  verifySuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  verifySuccessTitle: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: 'bold'
  },
  verifySuccessSub: {
    color: '#e2e8f0',
    fontSize: 10,
    marginTop: 2
  },
  verifySuccessSerial: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 2
  },
  verifyFail: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)'
  },
  verifyFailText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: 'bold'
  },
  offerCard: {
    backgroundColor: '#07090e',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 8
  },
  offerCandidate: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  offerStatusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6
  },
  offerStatusText: {
    color: '#34d399',
    fontSize: 8,
    fontWeight: 'bold'
  },
  offerDesig: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2
  },
  offerSerial: {
    color: '#38bdf8',
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 2
  },
  offerCtc: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2
  },
  payGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8
  },
  payItem: {
    width: '48%',
    backgroundColor: '#07090e',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  payLabel: {
    color: '#64748b',
    fontSize: 9
  },
  payVal: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2
  },
  netBox: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38bdf8',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4
  },
  netLabel: {
    color: '#94a3b8',
    fontSize: 10
  },
  netVal: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: 'bold'
  },
  emptyTaskText: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 12
  },
  taskCard: {
    backgroundColor: '#07090e',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 8
  },
  taskTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  taskPriority: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: 'bold'
  },
  taskDesc: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2
  },
  taskStatus: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 2
  },
  standupFeedItem: {
    backgroundColor: '#07090e',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 8
  },
  standupAuthor: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold'
  },
  standupDate: {
    color: '#64748b',
    fontSize: 9
  },
  standupText: {
    color: '#cbd5e1',
    fontSize: 10,
    marginTop: 3
  },
  reqCard: {
    backgroundColor: '#07090e',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 8
  },
  reqTitle: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold'
  },
  reqBody: {
    color: '#cbd5e1',
    fontSize: 10,
    marginTop: 2,
    fontStyle: 'italic'
  },
  reqMeta: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 2
  },
  moduleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 6
  },
  modOption: {
    backgroundColor: '#07090e',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  modOptionActive: {
    borderColor: '#0284c7',
    backgroundColor: '#0f172a'
  },
  modOptionText: {
    color: '#94a3b8',
    fontSize: 10
  },
  modOptionTextActive: {
    color: '#38bdf8',
    fontWeight: 'bold'
  },
  submitReqBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10
  },
  submitReqBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold'
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#07090e',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    flex: 1
  },
  navItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#38bdf8'
  },
  navIcon: {
    fontSize: 16
  },
  navLabel: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2
  },
  navLabelActive: {
    color: '#38bdf8',
    fontWeight: 'bold'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#0d121d',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff'
  },
  modalSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 10
  },
  modalCloseBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 6
  },
  modalCloseBtnText: {
    color: '#94a3b8',
    fontSize: 11
  },
  orgSelectItem: {
    backgroundColor: '#07090e',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 6
  },
  orgSelectItemActive: {
    borderColor: '#38bdf8'
  },
  orgSelectName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  orgSelectCode: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1
  },
  indPill: {
    backgroundColor: '#07090e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  indPillActive: {
    borderColor: '#38bdf8',
    backgroundColor: '#0f172a'
  },
  indPillText: {
    color: '#94a3b8',
    fontSize: 10
  },
  indPillTextActive: {
    color: '#38bdf8',
    fontWeight: 'bold'
  }
});
