// Gemini 비전 API로 음식 사진을 분석해 영양 정보를 추정한다.
// 클라이언트에서 직접 호출하며 API 키는 .env의 VITE_GEMINI_API_KEY 를 사용한다.
// (개인용 앱 기준. 키 노출이 우려되면 서버 프록시로 옮길 것.)

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// 기본 모델 + 폴백. 첫 모델이 404/지원불가면 다음 모델로 재시도.
const MODELS = [
    import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
].filter((v, i, a) => v && a.indexOf(v) === i);

const PROMPT = `너는 영양 분석 도우미야. 첨부된 음식 사진을 분석해.
사진에 "보이는 전체 양"(아직 사람 수로 나누기 전)을 기준으로,
구분되는 음식 항목마다 다음을 추정해줘:
- name: 음식 이름 (한국 음식이면 한국어로)
- weight_g: 추정 중량 (그램, 정수)
- carbs_g: 탄수화물 (그램)
- protein_g: 단백질 (그램)
- fat_g: 지방 (그램)
- calories_kcal: 칼로리 (kcal)
확신이 없으면 합리적으로 추정하고, 값은 0 이상으로. 음식이 아니면 빈 items 배열을 반환.
설명 없이 JSON만 출력해.`;

const RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        items: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    weight_g: { type: 'number' },
                    carbs_g: { type: 'number' },
                    protein_g: { type: 'number' },
                    fat_g: { type: 'number' },
                    calories_kcal: { type: 'number' },
                },
                required: ['name', 'weight_g', 'carbs_g', 'protein_g', 'fat_g', 'calories_kcal'],
            },
        },
        note: { type: 'string' },
    },
    required: ['items'],
};

// dataUrl: "data:image/jpeg;base64,...." 형식 문자열
function splitDataUrl(dataUrl) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
    if (!m) throw new Error('이미지 형식을 인식할 수 없습니다.');
    return { mimeType: m[1], base64: m[2] };
}

function extractJson(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        // 코드펜스나 잡텍스트가 섞인 경우 첫 { ... } 블록만 파싱 시도
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            try {
                return JSON.parse(text.slice(start, end + 1));
            } catch {
                return null;
            }
        }
        return null;
    }
}

function normalizeItems(parsed) {
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return items
        .map((it) => ({
            name: String(it.name ?? '').trim() || '음식',
            weight_g: Math.max(0, Math.round(Number(it.weight_g) || 0)),
            carbs_g: Math.max(0, Math.round(Number(it.carbs_g) || 0)),
            protein_g: Math.max(0, Math.round(Number(it.protein_g) || 0)),
            fat_g: Math.max(0, Math.round(Number(it.fat_g) || 0)),
            calories_kcal: Math.max(0, Math.round(Number(it.calories_kcal) || 0)),
        }))
        .filter((it) => it.name);
}

export function hasGeminiKey() {
    return Boolean(API_KEY);
}

export async function analyzeFoodImage(dataUrl) {
    if (!API_KEY) {
        throw new Error('VITE_GEMINI_API_KEY 가 설정되지 않았습니다. .env에 키를 넣어주세요.');
    }
    const { mimeType, base64 } = splitDataUrl(dataUrl);

    const body = {
        contents: [
            {
                parts: [
                    { text: PROMPT },
                    { inline_data: { mime_type: mimeType, data: base64 } },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
        },
    };

    let lastErr;
    for (const model of MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const errText = await res.text();
                // 모델 미지원/404 면 다음 모델로 폴백, 그 외 에러는 즉시 throw
                if (res.status === 404 || res.status === 400) {
                    lastErr = new Error(`${model}: ${res.status} ${errText.slice(0, 200)}`);
                    continue;
                }
                throw new Error(`Gemini 요청 실패 (${res.status}): ${errText.slice(0, 200)}`);
            }
            const json = await res.json();
            const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
            const parsed = extractJson(text);
            if (!parsed) throw new Error('AI 응답을 해석하지 못했습니다. 다시 시도해주세요.');
            return { items: normalizeItems(parsed), note: parsed.note || '', model };
        } catch (e) {
            lastErr = e;
            // 네트워크 등 일반 에러는 폴백하지 않고 종료
            if (!/404|400/.test(String(e.message))) throw e;
        }
    }
    throw lastErr || new Error('사용 가능한 Gemini 모델을 찾지 못했습니다.');
}
