import React, { useState } from 'react';
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
  ShieldCheck
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
  const { currentOrg, officeLocations, getTodayAttendance, punchAttendance } = useApp();
  
  const activeOffice = officeLocations[0] || {
    latitude: 17.4435,
    longitude: 78.3772,
    radiusMeters: 150,
    name: 'Primary Office'
  };

  // State for user's coordinates (starts around office location for demo convenience)
  const [userLat, setUserLat] = useState<number>(activeOffice.latitude + 0.0001);
  const [userLong, setUserLong] = useState<number>(activeOffice.longitude + 0.0001);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const todayRecord = getTodayAttendance();

  // Compute live distance
  const currentDistance = calculateHaversineDistance(
    userLat,
    userLong,
    activeOffice.latitude,
    activeOffice.longitude
  );

  const isInsideFence = currentDistance <= activeOffice.radiusMeters;

  // Real GPS lookup
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
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(`GPS Access: ${err.message}. Using simulated location.`);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Quick Location Simulation Presets
  const simulateOfficeLocation = () => {
    setUserLat(activeOffice.latitude + 0.0001);
    setUserLong(activeOffice.longitude + 0.0001);
    setGpsError(null);
  };

  const simulateRemoteLocation = () => {
    // 2.5 km away
    setUserLat(activeOffice.latitude + 0.02);
    setUserLong(activeOffice.longitude + 0.02);
    setGpsError(null);
  };

  const activeOfficeAddress = activeOffice.address || currentOrg.address || 'Corporate Headquarters';

  const handlePunch = () => {
    const res = punchAttendance(userLat, userLong, !isInsideFence, currentDistance, activeOfficeAddress);
    if (res.success) {
      onOpenStandup();
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
              Assigned Office: <span className="text-cyan-400 font-semibold">{activeOffice.name}</span> • Timezone: <span className="text-emerald-400 font-semibold">IST (UTC+5:30)</span>
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
              <span>Location Not Matched (Approval Needed)</span>
            </>
          )}
        </div>
      </div>

      {/* Geolocation Stats Radar Card - Showing Office Address instead of raw lat/long */}
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
            Office Radius: &le; {activeOffice.radiusMeters}m geofence
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
            className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
          >
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
            <span>{gpsLoading ? 'Reading GPS...' : 'Use Browser Location'}</span>
          </button>
          
          <div className="flex space-x-1">
            <button
              onClick={simulateOfficeLocation}
              className="flex-1 py-1 px-1.5 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 rounded text-[10px] font-semibold text-center"
            >
              Simulate In-Office
            </button>
            <button
              onClick={simulateRemoteLocation}
              className="flex-1 py-1 px-1.5 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 rounded text-[10px] font-semibold text-center"
            >
              Simulate Remote
            </button>
          </div>
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
            Today's Attendance Status ({getTodayISTDateString()} IST)
          </span>
          <div className="flex items-center space-x-2 mt-1">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                !todayRecord
                  ? 'bg-slate-500'
                  : 'bg-emerald-400'
              }`}
            />
            <span className="text-base font-bold text-white">
              {!todayRecord
                ? 'Not Recorded Today'
                : '✓ Attendance Recorded for Today (IST)'}
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
              className="w-full sm:w-auto justify-center px-6 py-3.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 transition flex items-center space-x-2"
            >
              <Clock className="w-4 h-4" />
              <span>Punch In (Mark Present - IST)</span>
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
