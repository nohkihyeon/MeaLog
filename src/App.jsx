import React, { useState } from 'react';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import MonthFeed from './components/MonthFeed';
import { useMeals } from './hooks/useMeals';

function App() {
  // Default to 2026-01-01 as per request (or current date if preferred, but user mentioned 2026)
  // Let's start with Jan 1st 2026 to show the full Year view structure
  const [currentDate, setCurrentDate] = useState('2026-01-01');

  const { meals, addMeal, deleteMeal, updateMeal } = useMeals();

  return (
    <Layout sidebar={<Sidebar selectedDate={currentDate} onSelectDate={setCurrentDate} />}>
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
