// Gemini 비전 API로 음식 사진을 분석해 영양 정보를 추정한다.
// 배포 빌드는 Supabase Edge Function(supabase/functions/gemini)을 거쳐 호출해서 API 키가 브라우저에 노출되지 않는다.
// 로컬 개발 시 .env에 VITE_GEMINI_API_KEY 를 넣으면 프록시 없이 직접 호출한다. (이 키는 번들에 포함되므로 배포 빌드에는 넣지 말 것)
import { supabase } from '../sync';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const PROXY_URL = import.meta.env.VITE_SUPABASE_URL && `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini`;
// 기본 모델 + 폴백. 첫 모델이 404/지원불가면 다음 모델로 재시도.
// 기본값은 Flash-Lite 계열 최신인 gemini-3.5-flash-lite (가장 빠르고 저렴).
// 폴백은 모두 현재 제공 중인 모델로 구성 (2.0/1.5 flash는 종료되어 제거).
const MODELS = [
    import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
].filter((v, i, a) => v && a.indexOf(v) === i);

const PROMPT = `너는 영양 분석 도우미야. 첨부된 사진을 분석해.

[영양성분표(영양정보 표)나 포장지의 영양 정보가 보이는 경우]
- 추정하지 말고 표에 적힌 숫자를 그대로 읽어. source는 "label".
- items에는 제품 1개(총 내용량 전체) 기준으로 1개 항목만 넣어. 표가 1회 제공량이나 100g 기준이면 총 내용량에 맞게 환산해.
- 총 내용량을 알 수 없으면 1회 제공량 기준으로 넣고 note에 어떤 기준인지 적어.
- name은 보이면 제품명, weight_g는 그 기준의 중량 (ml이면 g으로 간주).

[음식 사진인 경우]
- source는 "photo".
- 사진에 "보이는 전체 양"(아직 사람 수로 나누기 전)을 기준으로, 구분되는 음식 항목마다 추정해.

각 항목:
- name: 음식 이름 (한국 음식이면 한국어로)
- weight_g: 중량 (그램, 정수)
- carbs_g: 탄수화물 (그램)
- protein_g: 단백질 (그램)
- fat_g: 지방 (그램)
- calories_kcal: 칼로리 (kcal)
확신이 없으면 합리적으로 추정하고, 값은 0 이상으로. 음식도 성분표도 아니면 빈 items 배열을 반환.
설명 없이 JSON만 출력해.`;

// 사용자가 남긴 메모(양·메뉴명 등)는 사진보다 우선해서 반영
const photoPrompt = (hint) => (hint
    ? `${PROMPT}\n\n사용자 메모: "${hint}"\n메모에 적힌 양·메뉴명·조리법 정보는 사진보다 우선해서 반영해.`
    : PROMPT);

const RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        source: { type: 'string', enum: ['photo', 'label'] },
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
    required: ['source', 'items'],
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

// 직접 호출용 키가 있거나, Supabase 프록시를 쓸 수 있으면 AI 기능 사용 가능
export function hasGeminiKey() {
    return Boolean(API_KEY || (supabase && PROXY_URL));
}

async function callGemini(model, body) {
    if (API_KEY) {
        return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
            body: JSON.stringify(body),
        });
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('AI 분석은 로그인 후 사용할 수 있어요. 사이드바에서 로그인해주세요.');
    return fetch(PROXY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ model, body }),
    });
}

// 모델 폴백 루프를 공용화: parts + responseSchema 를 받아 파싱된 JSON을 돌려준다.
async function requestGeminiJson(parts, responseSchema) {
    if (!hasGeminiKey()) {
        throw new Error('Gemini를 쓸 수 없습니다. Supabase 설정 또는 .env의 VITE_GEMINI_API_KEY 를 확인해주세요.');
    }
    const body = {
        contents: [{ parts }],
        generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema,
        },
    };

    let lastErr;
    let rateLimited = false;
    for (const model of MODELS) {
        try {
            const res = await callGemini(model, body);
            if (!res.ok) {
                const errText = await res.text();
                if (!API_KEY && res.status === 404 && errText.includes('Requested function was not found')) {
                    throw new Error('Gemini 프록시(Edge Function)가 아직 배포되지 않았어요.');
                }
                if (res.status === 401 || res.status === 403) {
                    throw new Error('AI 호출 권한이 없어요. 다시 로그인해주세요.');
                }
                // 모델 미지원(404/400) 또는 무료 한도 초과(429)면 다음 모델로 폴백, 그 외 에러는 즉시 throw
                // (모델별로 무료 한도가 따로 잡히므로 한 모델이 막혀도 다음 모델은 쓸 수 있다)
                if (res.status === 404 || res.status === 400 || res.status === 429) {
                    if (res.status === 429) rateLimited = true;
                    lastErr = new Error(`${model}: ${res.status} ${errText.slice(0, 200)}`);
                    continue;
                }
                throw new Error(`Gemini 요청 실패 (${res.status}): ${errText.slice(0, 200)}`);
            }
            const json = await res.json();
            const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
            const parsed = extractJson(text);
            if (!parsed) throw new Error('AI 응답을 해석하지 못했습니다. 다시 시도해주세요.');
            return { parsed, model };
        } catch (e) {
            lastErr = e;
            // 네트워크 등 일반 에러는 폴백하지 않고 종료
            if (!/404|400/.test(String(e.message))) throw e;
        }
    }
    if (rateLimited) {
        throw new Error('Gemini 무료 사용량 한도에 걸렸어요. 1분 뒤(분당 한도) 또는 내일(일일 한도) 다시 시도해주세요.');
    }
    throw lastErr || new Error('사용 가능한 Gemini 모델을 찾지 못했습니다.');
}

// hint: 사용자가 남긴 메모 (예: "밥 반 공기", "곱빼기"). 없으면 사진만 보고 추정.
export async function analyzeFoodImage(dataUrl, hint = '') {
    const { mimeType, base64 } = splitDataUrl(dataUrl);
    const { parsed, model } = await requestGeminiJson(
        [
            { text: photoPrompt(hint.trim()) },
            { inline_data: { mime_type: mimeType, data: base64 } },
        ],
        RESPONSE_SCHEMA
    );
    return {
        items: normalizeItems(parsed),
        note: parsed.note || '',
        source: parsed.source === 'label' ? 'label' : 'photo',
        model,
    };
}

// ---------- 음식 이름(텍스트) → 영양 정보 추정 ----------

const NAME_PROMPT = (name) => `너는 영양 분석 도우미야. 사용자가 식단 기록 앱에 입력한 음식 이름: "${name}"
이 음식의 영양 정보를 추정해서 JSON으로 답해.
- is_food: 음식/음료로 볼 수 있으면 true
- confidence: 메뉴가 단품으로 명확하고(예: 브랜드 메뉴, 규격 제품) 1회 제공량이 뚜렷하면 "high",
  양이나 조리법에 따라 편차가 커서 사용자에게 양을 되물어야 하면 "ambiguous" (예: 삼겹살, 밥, 과일 등)
- question: confidence가 "ambiguous"일 때 사용자에게 물어볼 짧고 친근한 한 문장 (예: "삼겹살 200g 정도 드셨나요?")
- serving_g: 일반적인 1인 1회 섭취량 (그램, 정수)
- per_100g: 100g 기준 영양소 { carbs_g, protein_g, fat_g, calories_kcal }
값은 0 이상, 확신이 없어도 합리적으로 추정해. 설명 없이 JSON만 출력해.`;

const NAME_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        is_food: { type: 'boolean' },
        confidence: { type: 'string', enum: ['high', 'ambiguous'] },
        question: { type: 'string' },
        serving_g: { type: 'number' },
        per_100g: {
            type: 'object',
            properties: {
                carbs_g: { type: 'number' },
                protein_g: { type: 'number' },
                fat_g: { type: 'number' },
                calories_kcal: { type: 'number' },
            },
            required: ['carbs_g', 'protein_g', 'fat_g', 'calories_kcal'],
        },
    },
    required: ['is_food', 'confidence', 'serving_g', 'per_100g'],
};

const clamp1 = (n) => Math.max(0, Math.round((Number(n) || 0) * 10) / 10);

export async function analyzeFoodName(name) {
    const { parsed, model } = await requestGeminiJson(
        [{ text: NAME_PROMPT(name) }],
        NAME_RESPONSE_SCHEMA
    );
    if (!parsed.is_food) {
        throw new Error(`"${name}" 을(를) 음식으로 인식하지 못했어요.`);
    }
    return {
        confidence: parsed.confidence === 'ambiguous' ? 'ambiguous' : 'high',
        question: String(parsed.question || '').trim(),
        servingG: Math.max(1, Math.round(Number(parsed.serving_g) || 100)),
        per100: {
            carbs_g: clamp1(parsed.per_100g?.carbs_g),
            protein_g: clamp1(parsed.per_100g?.protein_g),
            fat_g: clamp1(parsed.per_100g?.fat_g),
            calories_kcal: clamp1(parsed.per_100g?.calories_kcal),
        },
        model,
    };
}
