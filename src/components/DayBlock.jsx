import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import InlineMealTable from './InlineMealTable';
import PhotoMealModal from './PhotoMealModal';
import { getEffectiveCalories, round1 } from '../utils/nutrition';

const DayBlock = ({ date, meals, allMeals, onUpdateMeal, onDeleteMeal, onAddMeal }) => {
    const dayNum = new Date(date).getDate();
    const [photoOpen, setPhotoOpen] = useState(false);

    // Calculate Summaries
    const sums = meals.reduce((acc, meal) => ({
        calories: acc.calories + getEffectiveCalories(meal),
        protein: acc.protein + (Number(meal.protein) || 0),
        carbs: acc.carbs + (Number(meal.carbs) || 0),
        fat: acc.fat + (Number(meal.fat) || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const handlePhotoConfirm = (newMeals) => {
        newMeals.forEach((m) => onAddMeal({ ...m, date }));
    };

    return (
        <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{dayNum}일</h2>
                <button
                    onClick={() => setPhotoOpen(true)}
                    title="사진으로 식단 추가"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.4rem 0.7rem', borderRadius: '999px',
                        border: '1px solid var(--border-color)', background: 'transparent',
                        color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                    }}
                >
                    <Camera size={15} color="#EB5757" /> 사진으로 추가
                </button>
            </div>

            <InlineMealTable
                meals={meals}
                allMeals={allMeals}
                onUpdate={onUpdateMeal}
                onDelete={onDeleteMeal}
                onAdd={(meal) => onAddMeal({ ...meal, date })}
            />

            <div style={{
                marginTop: '0.5rem',
                padding: '0.75rem 0',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                fontWeight: 500,
                gap: '0.5rem 2rem'
            }}>
                <span>칼로리 합 {round1(sums.calories)} kcal</span>
                <span>단백질 합 {round1(sums.protein)} g</span>
                <span>탄수 합 {round1(sums.carbs)} g</span>
                <span>지방 합 {round1(sums.fat)} g</span>
            </div>

            <PhotoMealModal
                isOpen={photoOpen}
                onClose={() => setPhotoOpen(false)}
                onConfirm={handlePhotoConfirm}
                date={date}
            />
        </d