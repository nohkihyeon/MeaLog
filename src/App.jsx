import React, { useState } from 'react';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import MonthFeed from './components/MonthFeed';
import StatsDashboard from './components/StatsDashboard';
import EnergyDashboard from './components/EnergyDashboard';
import ConfettiEffect from './components/ConfettiEffect';
import { useMeals } from './hooks/useMeals';
import { useDailyEnergy } from './hooks/useDailyEnergy';
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
  const [currentView, setCurrentView] = useState('feed'); // 'feed' | 'stats' | 'energy'
  const [easterEggActive, setEasterEggActive] = useState(false);

  const { meals, addMeal, deleteMeal, updateMeal } = useMeals();
  const dailyEnergy = useDailyEnergy();
  useSyncTriggers();

  // 소모 칼로리 데이터가 없는 사용자에게는 에너지 대시보드를 아예 노출하지 않는다
  const hasEnergyData = dailyEnergy.length > 0;
  const effectiveView = currentView === 'energy' && !hasEnergyData ? 'stats' : currentView;

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
        currentView={effectiveView}
        onChangeView={setCurrentView}
        onTriggerEasterEgg={handleTriggerEasterEgg}
        sidebar={
          <Sidebar
            selectedDate={currentDate}
            onSelectDate={(d) => {
              setCurrentDate(d);
              setSidebarOpen(false);
            }}
            currentView={effectiveView}
            onChangeView={(v) => {
              setCurrentView(v);
              setSidebarOpen(false);
            }}
            hasEnergyData={hasEnergyData}
            onTriggerEasterEgg={handleTriggerEasterEgg}
          />
        }
      >
        {effectiveView === 'feed' ? (
          <MonthFeed
            date={currentDate}
            meals={meals}
            onAddMeal={addMeal}
            onDeleteMeal={deleteMeal}
            onUpdateMeal={updateMeal}
            onGoToToday={() => setCurrentDate(todayStr())}
          />
        ) : effectiveView === 'energy' ? (
          <EnergyDashboard dailyEnergy={dailyEnergy} />
        ) : (
          <StatsDashboard meals={meals} dailyEnergy={dailyEnergy} />
        )}
      </Layout>
    </>
  )
}

export default App
