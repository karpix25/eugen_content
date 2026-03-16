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

function App() {
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

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex overflow-hidden font-sans selection:bg-blue-600/30 selection:text-blue-500">
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

          {activeTab === 'dashboard' && currentUser.is_admin && (
            <DashboardTab authToken={authToken} />
          )}

          {activeTab === 'monitor' && (
            <MonitoringTab 
              videos={videos}
              channels={channels}
              loadingVideos={loading}
              onEvaluate={handleEvaluateVideo}
              onApprove={handleApproveVideo}
              onComplete={handleCompleteVideo}
              onDelete={handleDeleteVideo}
              onDeleteChannel={handleDeleteChannel}
              onToggleChannelPublic={handleToggleChannelPublic}
              onRefresh={updateData}
              onAddChannel={handleAddChannel}
              processingId={processingId}
              currentUserProfile={currentUser}
            />
          )}

          {activeTab === 'clips' && (
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
              currentUserProfile={currentUser}
            />
          )}

          {activeTab === 'workers' && currentUser.is_admin && (
            <UsersTab 
              users={users} 
              onUpdate={updateData} 
              authToken={authToken} 
            />
          )}


          {activeTab === 'styles' && currentUser.is_admin && (
            <StyleManager 
              authToken={authToken} 
              isAdmin={currentUser.is_admin} 
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab 
              currentUser={currentUser} 
              authToken={authToken} 
              onUpdate={updateData} 
              plaques={plaques} 
              onAddPlaque={addPlaque} 
              onDeletePlaque={deletePlaque} 
            />
          )}
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
