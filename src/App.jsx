import React, { useState } from 'react';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import MonthFeed from './components/MonthFeed';
import StatsDashboard from './components/StatsDashboard';
import ConfettiEffect from './components/ConfettiEffect';
import { useMeals } from './hooks/useMeals';
import { useSyncTriggers } from './hooks/useSync';

function todayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function App() {
  // Default to today's date
  const [currentDate, setCurrentDate] = useState(todayStr);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('feed'); // 'feed' | 'stats'
  const [easterEggActive, setEasterEggActive] = useState(false);

  const { meals, addMeal, deleteMeal, updateMeal } = useMeals();
  useSyncTriggers();

  const handleTriggerEasterEgg = () => {
    setEasterEggActive(true);
    // Switch to stats view to highlight the easter egg's special details!
    setCurrentView('stats');
  };

  return (
    <>
      <ConfettiEffect active={easterEggActive} onComplete={() => setEasterEggActive(false)} />
      <Layout
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
        onCloseSidebar={() => setSidebarOpen(false)}
        currentView={currentView}
        onChangeView={setCurrentView}
        onTriggerEasterEgg={handleTriggerEasterEgg}
        sidebar={
          <Sidebar
            selectedDate={currentDate}
            onSelectDate={(d) => {
              setCurrentDate(d);
              setSidebarOpen(false);
            }}
            currentView={currentView}
            onChangeView={setCurrentView}
            onTriggerEasterEgg={handleTriggerEasterEgg}
          />
        }
      >
        {currentView === 'feed' ? (
          <MonthFeed
            date={currentDate}
            meals={meals}
            onAddMeal={addMeal}
            onDeleteMeal={deleteMeal}
            onUpdateMeal={updateMeal}
            onGoToToday={() => setCurrentDate(todayStr())}
          />
        ) : (
          <StatsDashboard meals={meals} />
        )}
      </Layout>
    </>
  )
}

export default App
