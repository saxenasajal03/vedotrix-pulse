import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building,
  Navigation,
  Compass,
  FileEdit,
  ShieldCheck,
  CalendarX,
  Undo2,
  LocateFixed
} from 'lucide-react';
import { calculateHaversineDistance, formatDistance } from '../lib/geoUtils';
import { formatISTTime, getTodayISTDateString } from '../lib/serialUtils';

interface GeoAttendanceCardProps {
  onRequestRegularization: (attendanceId: string) => void;
  onOpenStandup: () => void;
}

export const GeoAttendanceCard: React.FC<GeoAttendanceCardProps> = ({
  onRequestRegularization,
  onOpenStandup
}) => {
  const {
    currentOrg,
    currentProfile,
    officeLocations,
    leaveRequests,
    getTodayAttendance,
    punchAttendance,
    cancelLeaveRequest,
    addToast
  } = useApp();

  const activeOffice = officeLocations[0] || {
    latitude: 17.4435,
    longitude: 78.3772,
    radiusMeters: 150,
    name: 'Primary Office',
    address: currentOrg.address || 'Corporate Headquarters'
  };

  const [userLat, setUserLat] = useState<number>(activeOffice.latitude + 0.0001);
  const [userLong, setUserLong] = useState<number>(activeOffice.longitude + 0.0001);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [hasRealGps, setHasRealGps] = useState(false);
  const [isWithdrawingLeave, setIsWithdrawingLeave] = useState(false);

  const todayStr = getTodayISTDateString();
  const todayRecord = getTodayAttendance();

  // Check if employee has an active leave request covering today
  const activeLeaveToday = leaveRequests.find(
    (l) =>
      l.employeeId === currentProfile.id &&
      (l.status === 'approved' || l.status === 'pending') &&
      l.startDate <= todayStr &&
      l.endDate >= todayStr
  );

  // Compute live distance using standard Haversine formula
  const currentDistance = calculateHaversineDistance(
    userLat,
    userLong,
    activeOffice.latitude,
    activeOffice.longitude
  );

  const isInsideFence = currentDistance <= activeOffice.radiusMeters;

  // Real GPS lookup with high accuracy
  const captureRealGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLong(pos.coords.longitude);
        setHasRealGps(true);
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(`GPS Access: ${err.message}. Please allow location access in your browser.`);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Attempt real GPS once on mount
  useEffect(() => {
    if (navigator.geolocation && !hasRealGps) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLong(pos.coords.longitude);
          setHasRealGps(true);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  const activeOfficeAddress = activeOffice.address || currentOrg.address || 'Corporate Headquarters';

  const handlePunch = () => {
    if (activeLeaveToday) {
      addToast(
        'Leave Active',
        `You cannot record attendance while on ${activeLeaveToday.status} leave today.`,
        'warning'
      );
      return;
    }

    const res = punchAttendance(userLat, userLong, !isInsideFence, currentDistance, activeOfficeAddress);
    if (res.success) {
      onOpenStandup();
    }
  };

  const handleWithdrawPendingLeave = async () => {
    if (!activeLeaveToday || activeLeaveToday.status !== 'pending') return;
    setIsWithdrawingLeave(true);
    try {
      await cancelLeaveRequest(activeLeaveToday.id);
      addToast('Leave Withdrawn 🔓', 'Your pending leave was cancelled. Attendance punch is now unlocked!', 'success');
    } catch (err) {
      addToast('Error', 'Could not withdraw leave request.', 'error');
    } finally {
      setIsWithdrawingLeave(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5 sm:space-y-6">
      {/* Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-white truncate">Smart Office Presence & Geo Attendance</h3>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">
              Assigned Office: <span className="text-cyan-400 font-semibold">{activeOffice.name}</span> • Timezone: <span className="text-emerald-400 font-semibold">IST (Asia/Kolkata)</span>
            </p>
          </div>
        </div>

        {/* Live Geofence Status Pill */}
        <div
          className={`self-start sm:self-auto flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold border shrink-0 ${
            isInsideFence
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}
        >
          {isInsideFence ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Office Geofence Matched</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Outside Perimeter (Remote / Approval Needed)</span>
            </>
          )}
        </div>
      </div>

      {/* Active Leave Alert Banner (Locks attendance punch if leave is active for today) */}
      {activeLeaveToday && (
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          activeLeaveToday.status === 'pending'
            ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
            : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
        }`}>
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-lg shrink-0 ${
              activeLeaveToday.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              <CalendarX className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Attendance Locked: {activeLeaveToday.leaveType.toUpperCase()} LEAVE ACTIVE TODAY
                </span>
                <span className={`px-2 py-0.2 rounded-full text-[9px] font-extrabold uppercase ${
                  activeLeaveToday.status === 'pending' ? 'bg-amber-500/30 text-amber-300' : 'bg-rose-500/30 text-rose-300'
                }`}>
                  {activeLeaveToday.status}
                </span>
              </div>
              <p className="text-[11px] mt-1 text-slate-300 leading-relaxed">
                {activeLeaveToday.status === 'pending'
                  ? 'You submitted a leave request covering today that is currently pending approval. To mark presence, withdraw your pending leave request.'
                  : 'Your leave application for today has been approved by management. Approved leaves cannot be self-withdrawn; please contact HR or your Reporting Manager to adjust.'}
              </p>
            </div>
          </div>

          {activeLeaveToday.status === 'pending' && (
            <button
              onClick={handleWithdrawPendingLeave}
              disabled={isWithdrawingLeave}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl transition shrink-0 shadow-md"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>{isWithdrawingLeave ? 'Withdrawing...' : 'Withdraw Leave & Unlock'}</span>
            </button>
          )}
        </div>
      )}

      {/* Geolocation Live Coordinates & Verification Box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center">
            <MapPin className="w-3.5 h-3.5 mr-1 text-indigo-400" />
            Official Office Location
          </span>
          <p className="text-xs font-bold text-white mt-1 leading-snug">
            {activeOfficeAddress}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">
            Office Perimeter: &le; {activeOffice.radiusMeters}m geofence
          </span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center">
            <Compass className="w-3.5 h-3.5 mr-1 text-cyan-400" />
            Presence Verification Status
          </span>
          <p className={`text-xs font-extrabold mt-1 ${isInsideFence ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isInsideFence ? 'On-Premise Verified' : 'Work From Home / Remote'}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block leading-tight">
            {isInsideFence
              ? `Within office perimeter (${formatDistance(currentDistance)} away)`
              : `${formatDistance(currentDistance)} from office • Requires Manager/HR Approval`}
          </span>
        </div>

        <div className="flex flex-col justify-center space-y-1.5">
          <button
            onClick={captureRealGps}
            disabled={gpsLoading}
            className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition shadow-sm"
          >
            <LocateFixed className="w-4 h-4 text-white" />
            <span>{gpsLoading ? 'Detecting Precise GPS...' : hasRealGps ? 'Recalibrate Live GPS' : 'Acquire Device Location'}</span>
          </button>
          <p className="text-[9px] text-slate-400 text-center">
            {hasRealGps ? 'Live device GPS coordinates verified' : 'Click to sync with high-precision GPS'}
          </p>
        </div>
      </div>

      {gpsError && (
        <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-300 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Today's Punch Action Box */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 p-5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Today's Attendance Status ({todayStr} IST)
          </span>
          <div className="flex items-center space-x-2 mt-1">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                !todayRecord
                  ? activeLeaveToday ? 'bg-amber-400' : 'bg-slate-500'
                  : 'bg-emerald-400'
              }`}
            />
            <span className="text-base font-bold text-white">
              {todayRecord
                ? '✓ Attendance Recorded for Today (IST)'
                : activeLeaveToday
                ? `Locked: On ${activeLeaveToday.leaveType.toUpperCase()} Leave`
                : 'Not Recorded Today'}
            </span>
          </div>

          {todayRecord && (
            <div className="text-xs text-slate-400 space-x-3 mt-1.5 flex flex-wrap items-center gap-y-1">
              <span>
                Punched In: <strong className="text-emerald-400">{formatISTTime(todayRecord.checkInTime!)} IST</strong>
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3 mr-1 text-emerald-400" />
                Present • Checkout Not Required
              </span>
              {todayRecord.totalHours > 0 && (
                <span>
                  Standard Shift: <strong className="text-cyan-400 font-mono">{todayRecord.totalHours} hrs</strong>
                </span>
              )}
            </div>
          )}

          {todayRecord && todayRecord.approvalStatus === 'pending_manager_approval' && (
            <div className="mt-2 inline-flex items-center text-[10px] text-amber-300 bg-amber-950/50 border border-amber-500/30 px-2.5 py-1 rounded-lg">
              <AlertTriangle className="w-3 h-3 mr-1.5 text-amber-400 shrink-0" />
              Presence approval pending from assigned Reporting Manager or HR
            </div>
          )}
        </div>

        {/* Punch Button & Status */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {!todayRecord ? (
            <button
              onClick={handlePunch}
              disabled={Boolean(activeLeaveToday)}
              className={`w-full sm:w-auto justify-center px-6 py-3.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeLeaveToday
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>
                {activeLeaveToday
                  ? `Locked: On ${activeLeaveToday.leaveType} Leave`
                  : 'Punch In (Mark Present - IST)'}
              </span>
            </button>
          ) : (
            <div className="flex flex-col sm:items-end space-y-1.5 w-full sm:w-auto">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Marked Present for Today</span>
              </div>
              {todayRecord.regularizationStatus === 'none' && (
                <button
                  onClick={() => onRequestRegularization(todayRecord.id)}
                  className="inline-flex items-center space-x-1 text-xs text-cyan-400 hover:underline"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>Request Regularization</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
