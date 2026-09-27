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
import { TeamChat } from './components/TeamChat';
import { OfferLetter } from './types';
import { MessageSquare } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { isAuthenticated, isVedotrixSuperadmin, currentProfile, orgProfiles, chatMessages } = useApp();
  const [activeTab, setActiveTab] = useState<string>(() => {
    return isVedotrixSuperadmin ? 'superadmin' : 'dashboard';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFloatingChatWidgetOpen, setIsFloatingChatWidgetOpen] = useState(false);
  const isPopoutMode =
    typeof window !== 'undefined' &&
    (window.location.hash === '#chat-popout' || window.location.hash === '#widget');

  const chatUnreadCount = chatMessages.filter((m) => m.senderId !== currentProfile?.id).length;

  // Security Guard: Prevent non-Vedotrix organizations from ever seeing Super Controller Hub
  React.useEffect(() => {
    if (activeTab === 'superadmin' && !isVedotrixSuperadmin) {
      setActiveTab('dashboard');
    }
  }, [isVedotrixSuperadmin, activeTab]);

  // Security Guard: Restrict Employee Directory to top leadership and managers with direct reports
  const isTopLeadership =
    currentProfile?.role === 'hr' ||
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'superadmin' ||
    isVedotrixSuperadmin;
  const managedEmployeesCount = orgProfiles.filter((p) => p.managerId === currentProfile?.id).length;
  const canAccessEmployees = isTopLeadership || managedEmployeesCount > 0;

  React.useEffect(() => {
    if (activeTab === 'employees' && !canAccessEmployees) {
      setActiveTab('dashboard');
    }
  }, [activeTab, canAccessEmployees]);

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

  if (isPopoutMode) {
    return (
      <div className="h-screen w-screen bg-[var(--bg-page)] text-[var(--text-primary)] p-2 sm:p-4 overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
        <TeamChat isWidgetMode={false} />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex font-['Plus_Jakarta_Sans',sans-serif] transition-colors duration-200">
      {/* 1. Responsive Sidebar: Fixed Dark Navy on Left */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenVerifyModal={() => handleOpenVerify()}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* 2. Main Work Area (Header + Tab Page Content) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-[var(--bg-page)] transition-colors duration-200">
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
          {activeTab === 'chat' && (
            <TeamChat
              onCloseWidget={() => {
                setIsFloatingChatWidgetOpen(true);
                setActiveTab('dashboard');
              }}
            />
          )}

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

      {/* Floating Slack-Style Chat Widget Window */}
      {isFloatingChatWidgetOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[95vw] sm:w-[480px] h-[620px] max-h-[85vh] shadow-2xl rounded-2xl overflow-hidden border border-slate-200 bg-white flex flex-col animate-in slide-in-from-bottom-5 duration-200">
          <TeamChat
            isWidgetMode={true}
            onCloseWidget={() => setIsFloatingChatWidgetOpen(false)}
            onMaximizeWidget={() => {
              setIsFloatingChatWidgetOpen(false);
              setActiveTab('chat');
            }}
          />
        </div>
      )}

      {/* Floating Chat Quick Launcher */}
      {!isFloatingChatWidgetOpen && activeTab !== 'chat' && (
        <button
          onClick={() => setIsFloatingChatWidgetOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-6 z-40 px-4 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-xl flex items-center space-x-2 transition hover:scale-105 active:scale-95 border border-white/20"
          title="Open Team Chat Floating Widget"
        >
          <div className="relative">
            <MessageSquare className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5" />
          </div>
          <span>Team Chat</span>
          {chatUnreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-extrabold animate-pulse">
              {chatUnreadCount}
            </span>
          )}
        </button>
      )}

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
