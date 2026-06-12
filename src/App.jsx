import React, { useState } from 'react';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import MonthFeed from './components/MonthFeed';
import { useMeals } from './hooks/useMeals';
import { useSyncTriggers } from './hooks/useSync';

function App() {
  // Default to today's date
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { meals, addMeal, deleteMeal, updateMeal } = useMeals();
  useSyncTriggers();

  return (
    <Layout
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen(o => !o)}
      onCloseSidebar={() => setSidebarOpen(false)}
      sidebar={
        <Sidebar
          selectedDate={currentDate}
          onSelectDate={(d) => {
            setCurrentDate(d);
            setSidebarOpen(false);
          }}
        />
      }
    >
      <MonthFeed
        date={currentDate}
        meals={meals}
        onAddMeal={addMeal}
        onDeleteMeal={deleteMeal}
        onUpdateMeal={updateMeal}
      />
    </Layout>
  )
}

export default App
