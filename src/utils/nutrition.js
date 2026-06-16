// 탄단지(g)로 칼로리를 환산: 탄수 4, 단백질 4, 지방 9 kcal/g
export const calcMacroKcal = (meal) =>
    (Number(meal.carbs) || 0) * 4 +
    (Number(meal.protein) || 0) * 4 +
    (Number(meal.fat) || 0) * 9;

// 직접 입력한 칼로리가 있으면 그 값을, 없으면 탄단지 환산값을 사용한다.
// 합계 계산과 화면 표시가 같은 규칙을 쓰도록 한 곳에서 정의.
export const getEffectiveCalories = (meal) => {
    const c = meal.calories;
    if (c !== '' && c !== null && c !== undefined && !Number.isNaN(Number(c))) {
        return Number(c);
    }
    return calcMacroKcal(meal);
};
