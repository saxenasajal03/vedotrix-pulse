import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DashboardOverview } from './components/DashboardOverview';
import { SuperAdminConsole } from './components/SuperAdminConsole';
import { OfferLettersList } from './components/OfferLettersList';
import { TaskBoard } from './components/TaskBoard';
import { StandupsView } from './components/StandupsView';
import { PayrollManager } from './components/PayrollManager';
import { GeoAttendanceCard } from './components/GeoAttendanceCard';
import { RegularizationApprovalQueue } from './components/RegularizationApprovalQueue';
import { PublicVerifyModal } from './components/PublicVerifyModal';
import { OfferLetterModal } from './components/OfferLetterModal';
import { OfferLetterViewerModal } from './components/OfferLetterViewerModal';
import { RegularizationModal } from './components/RegularizationModal';
import { DailyStandupModal } from './components/DailyStandupModal';
import { ToastContainer } from './components/ToastContainer';
import { LoginScreen } from './components/LoginScreen';
import { AccessRequestsView } from './components/AccessRequestsView';
import { EmployeesDirectory } from './components/EmployeesDirectory';
import { LeaveManager } from './components/LeaveManager';
import { MeetingsManager } from './components/MeetingsManager';
import { NoticeBoardView } from './components/NoticeBoardView';
import { OfferLetter } from './types';

const MainLayout: React.FC = () => {
  const { isAuthenticated, isVedotrixSuperadmin } = useApp();
  const [activeTab, setActiveTab] = useState<string>(() => {
    return isVedotrixSuperadmin ? 'superadmin' : 'dashboard';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Security Guard: Prevent non-Vedotrix organizations from ever seeing Super Controller Hub
  React.useEffect(() => {
    if (activeTab === 'superadmin' && !isVedotrixSuperadmin) {
      setActiveTab('dashboard');
    }
  }, [isVedotrixSuperadmin, activeTab]);

  // Modal States
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyInitialSerial, setVerifyInitialSerial] = useState('');
  
  const [isCreateOfferOpen, setIsCreateOfferOpen] = useState(false);
  const [viewingOffer, setViewingOffer] = useState<OfferLetter | null>(null);

  const [regularizeAttendanceId, setRegularizeAttendanceId] = useState<string | null>(null);
  const [isStandupOpen, setIsStandupOpen] = useState(false);

  const handleOpenVerify = (serial?: string) => {
    if (serial) setVerifyInitialSerial(serial);
    setIsVerifyModalOpen(true);
  };

  // If not authenticated, display the high-security Login Screen
  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fe] text-slate-800 flex font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 1. Responsive Sidebar: Fixed Dark Navy on Left */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenVerifyModal={() => handleOpenVerify()}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* 2. Main Work Area (Header + Tab Page Content) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-[#f4f7fe]">
        {/* Top Navbar */}
        <Navbar
          onOpenVerifyModal={() => handleOpenVerify()}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
          mobileOpen={mobileMenuOpen}
        />

        {/* Dynamic Tab Content with responsive padding */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 md:pb-8 min-w-0">
          {activeTab === 'superadmin' && isVedotrixSuperadmin && <SuperAdminConsole />}

          {activeTab === 'dashboard' && (
            <DashboardOverview
              onOpenCreateOffer={() => setIsCreateOfferOpen(true)}
              onRequestRegularization={(id) => setRegularizeAttendanceId(id)}
              onOpenStandup={() => setIsStandupOpen(true)}
              onOpenVerify={(serial) => handleOpenVerify(serial)}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'offers' && (
            <OfferLettersList
              onOpenCreate={() => setIsCreateOfferOpen(true)}
              onViewOffer={(offer) => setViewingOffer(offer)}
              onOpenVerify={(serial) => handleOpenVerify(serial)}
            />
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <GeoAttendanceCard
                onRequestRegularization={(id) => setRegularizeAttendanceId(id)}
                onOpenStandup={() => setIsStandupOpen(true)}
              />
              <RegularizationApprovalQueue />
            </div>
          )}

          {activeTab === 'tasks' && <TaskBoard />}
          {activeTab === 'employees' && <EmployeesDirectory />}

          {activeTab === 'standups' && (
            <StandupsView onOpenSubmitModal={() => setIsStandupOpen(true)} />
          )}

          {activeTab === 'payroll' && <PayrollManager />}

          {activeTab === 'meetings' && <MeetingsManager />}

          {activeTab === 'notices' && <NoticeBoardView />}

          {activeTab === 'leaves' && <LeaveManager />}

          {activeTab === 'access_requests' && <AccessRequestsView />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
      />

      {/* Global Modals */}
      <PublicVerifyModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        initialSerial={verifyInitialSerial}
      />

      <OfferLetterModal
        isOpen={isCreateOfferOpen}
        onClose={() => setIsCreateOfferOpen(false)}
      />

      <OfferLetterViewerModal
        offer={viewingOffer}
        onClose={() => setViewingOffer(null)}
        onOpenVerify={(serial) => {
          setViewingOffer(null);
          handleOpenVerify(serial);
        }}
      />

      <RegularizationModal
        attendanceId={regularizeAttendanceId}
        onClose={() => setRegularizeAttendanceId(null)}
      />

      <DailyStandupModal
        isOpen={isStandupOpen}
        onClose={() => setIsStandupOpen(false)}
      />

      {/* Reactive Toasts */}
      <ToastContainer />
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}

export default App;
