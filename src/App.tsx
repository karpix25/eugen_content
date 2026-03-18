import React from 'react';
import { AnimatePresence } from 'motion/react';
import { Auth } from './components/Auth';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MonitoringTab } from './components/sections/MonitoringTab';
import { ClipsTab } from './components/sections/ClipsTab';
import { UsersTab } from './components/sections/UsersTab';
import { WorkersTab } from './components/sections/WorkersTab';
import { DashboardTab } from './components/sections/DashboardTab';
import { SettingsTab } from './components/sections/SettingsTab';
import CarouselWizard from './components/CarouselWizard';
import StyleManager from './components/StyleManager';
import { useAppStore } from './hooks/useAppStore';
import { useProfileSetup } from './hooks/useProfileSetup';
import { SetupRequiredEmptyState } from './components/sections/SetupRequiredEmptyState';
import OnboardingWizard from './components/OnboardingWizard';

function App() {
  const [onboardingCompleted, setOnboardingCompleted] = React.useState(false);
  const {
    authToken,
    setAuthToken,
    currentUser,
    activeTab,
    setActiveTab,
    isSidebarOpen,
    setSidebarOpen,
    channels,
    videos,
    loading,
    processingId,
    manualYoutubeUrl,
    setManualYoutubeUrl,
    handleEvaluateVideo,
    handleApproveVideo,
    handleCompleteVideo,
    handleDeleteVideo,
    handleAddManualVideo,
    handleAddChannel,
    handleDeleteChannel,
    handleSyncChannel,
    clips,
    totalClips,
    loadMoreClips,
    users,
    plaques,
    handleLogout,
    updateData,
    addPlaque,
    deletePlaque,
    handleToggleChannelPublic,
    handleToggleClipPublic,
    handleToggleFolderPublic,
    targetAudience
  } = useAppStore();

  const [selectedCarouselClip, setSelectedCarouselClip] = React.useState<any>(null);
  const { isComplete } = useProfileSetup(currentUser);
  const onboardingKey = React.useMemo(
    () => currentUser ? `onboarding_done_${currentUser.id}` : null,
    [currentUser]
  );

  React.useEffect(() => {
    if (!onboardingKey) return;
    const stored = localStorage.getItem(onboardingKey);
    setOnboardingCompleted(stored === 'true');
  }, [onboardingKey]);

  const handleOnboardingComplete = () => {
    if (onboardingKey) {
      localStorage.setItem(onboardingKey, 'true');
      setOnboardingCompleted(true);
    }
    updateData();
  };

  if (!authToken) {
    return <Auth onLogin={setAuthToken} />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  const isTabLocked = (tab: string) => {
    // During setup, settings are always unlocked, but other tabs are locked until complete
    if (tab === 'settings' || tab === 'styles') return false;
    return !isComplete;
  };

  const renderContent = () => {
    if (isTabLocked(activeTab)) {
      return (
        <SetupRequiredEmptyState onGoToSettings={() => setActiveTab('settings')} />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return currentUser.is_admin && <DashboardTab authToken={authToken} />;

      case 'monitor':
        return (
          <MonitoringTab
            videos={videos}
            channels={channels}
            loadingVideos={loading}
            onEvaluate={handleEvaluateVideo}
            onApprove={handleApproveVideo}
            onComplete={handleCompleteVideo}
            onDelete={handleDeleteVideo}
            onDeleteChannel={handleDeleteChannel}
            onSyncChannel={handleSyncChannel}
            onToggleChannelPublic={handleToggleChannelPublic}
            onRefresh={updateData}
            onAddChannel={handleAddChannel}
            processingId={processingId}
            currentUserProfile={currentUser}
          />
        );

      case 'clips':
        return (
          <ClipsTab
            clips={clips}
            totalClips={totalClips}
            loadMoreClips={loadMoreClips}
            plaques={plaques}
            onUpdate={updateData}
            authToken={authToken}
            isAdmin={currentUser.is_admin}
            onOpenCarouselWizard={setSelectedCarouselClip}
            loading={loading}
            onTogglePublic={handleToggleClipPublic}
            onToggleFolderPublic={handleToggleFolderPublic}
            onDeleteFolder={handleDeleteVideo}
            currentUserProfile={currentUser}
          />
        );

      case 'workers':
        return currentUser.is_admin && (
          <UsersTab
            users={users}
            onUpdate={updateData}
            authToken={authToken}
          />
        );

      case 'styles':
        return currentUser.is_admin && (
          <StyleManager
            authToken={authToken}
            isAdmin={currentUser.is_admin}
          />
        );

      case 'settings':
        return (
          <SettingsTab
            currentUser={currentUser}
            authToken={authToken}
            onUpdate={updateData}
            plaques={plaques}
            onAddPlaque={addPlaque}
            onDeletePlaque={deletePlaque}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex overflow-hidden font-sans selection:bg-blue-600/30 selection:text-blue-500">
      {!isComplete && !onboardingCompleted && (
        <OnboardingWizard
          currentUser={currentUser}
          authToken={authToken}
          plaques={plaques}
          onComplete={handleOnboardingComplete}
        />
      )}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        currentUser={currentUser}
        isOpen={isSidebarOpen}
        setIsOpen={setSidebarOpen}
      />

      <main className="flex-1 min-w-0 h-screen overflow-y-auto custom-scrollbar relative">
        <div className="max-w-[1200px] mx-auto p-4 md:p-8">
          <Header
            currentUser={currentUser}
            onMenuToggle={() => setSidebarOpen(!isSidebarOpen)}
            isSidebarOpen={isSidebarOpen}
          />

          {renderContent()}
        </div>

        <AnimatePresence>
          {selectedCarouselClip && (
            <CarouselWizard
              clip={selectedCarouselClip}
              authToken={authToken}
              targetAudience={targetAudience}
              onClose={() => setSelectedCarouselClip(null)}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
