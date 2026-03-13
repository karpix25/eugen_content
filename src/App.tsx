import React from 'react';
import { Auth } from './components/Auth';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ClipsTab } from './components/sections/ClipsTab';
import { UsersTab } from './components/sections/UsersTab';
import { PublicationsTab } from './components/sections/PublicationsTab';
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
    clips,
    users,
    publications,
    plaques,
    handleLogout,
    updateData,
    addPlaque,
    deletePlaque
  } = useAppStore();

  if (!authToken) {
    return <Auth onLogin={setAuthToken} />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex font-sans selection:bg-emerald-500/30 selection:text-emerald-400">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
        currentUser={currentUser}
        isOpen={false}
        setIsOpen={() => {}}
      />

      <main className="flex-1 min-w-0 h-screen overflow-y-auto custom-scrollbar relative">
        <div className="max-w-[1200px] mx-auto p-4 md:p-8">
          <Header currentUser={currentUser} />

          {activeTab === 'clips' && (
            <ClipsTab 
              clips={clips} 
              plaques={plaques}
              onUpdate={updateData} 
              authToken={authToken} 
              isAdmin={currentUser.is_admin} 
            />
          )}

          {activeTab === 'workers' && currentUser.is_admin && (
            <UsersTab 
              users={users} 
              onUpdate={updateData} 
              authToken={authToken} 
            />
          )}

          {activeTab === 'publications' && (
            <PublicationsTab 
              publications={publications} 
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
      </main>
    </div>
  );
}

export default App;
