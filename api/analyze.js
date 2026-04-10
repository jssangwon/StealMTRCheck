// api/analyze.js
// ─────────────────────────────────────────────────────────
//  Vercel Serverless Function — Gemini API 버전
//  브라우저 → 이 함수 → Google Gemini API
// ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a steel mill test certificate (MTC) data extractor. Your ONLY job is to output a single valid JSON object. Do NOT write any explanation, analysis, preamble, or text of any kind before or after the JSON. Start your response with { and end with }.

CRITICAL - Chemical value unit conversion (check ALL cases):
1. Standard wt%: values already in range 0.0001 ~ 2.0 → use as-is.
2. Single multiplier for entire table: Certificate shows x1000 applied to ALL columns → divide ALL by 1,000.
3. Per-column unit CODE notation: A row of single digits (2,3,4,5) above value row: 2=×100, 3=×1000, 4=×10000, 5=×100000.
4. Per-column unit TEXT: Each column shows "X 1000" or "X 100" → apply per column.
5. No unit notation but values abnormally large → divide by 1,000.
Final check: ALL chemical values must be wt% (range 0.0001~2.0).

MULTIPLE DIMENSIONS: Extract ALL thickness rows into dimensions array. Each dimension has its own chemical and mechanical block. If chemical is shared, copy into every dimension.

Required JSON (output this and nothing else):
{"steelGrade":"exact grade code e.g. SS400","manufacturer":"mill name","heatNo":"heat number","orderNo":"cert number","dimensions":[{"thickness":"e.g. 16mm","chemical":{"C":null,"Si":null,"Mn":null,"P":null,"S":null,"Cu":null,"Ni":null,"Cr":null,"Mo":null,"V":null,"Nb":null,"Ti":null,"B":null,"Ceq":null},"mechanical":{"yieldStrength":null,"tensileStrength":null,"elongation":null,"charpy":null}}]}

Units: chemical=wt%, Strength=MPa, Elongation=%, Charpy=J. Use null if not found.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API 키가 설정되지 않았습니다. Vercel 환경변수에 GEMINI_API_KEY를 추가해주세요.' });
  }

  const { data, mediaType } = req.body;
  if (!data || !mediaType) {
    return res.status(400).json({ error: '파일 데이터가 없습니다.' });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{
          parts: [
            { inline_data: { mime_type: mediaType, data } },
            { text: '이 철판 성적서의 화학조성과 기계적 성질을 모두 추출하여 JSON으로 반환해주세요.' }
          ]
        }],
        generationConfig: { maxOutputTokens: 1000, temperature: 0 }
      }),
    });

    const geminiData = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: geminiData?.error?.message || '알 수 없는 오류' });
    }

    // Gemini 응답을 Anthropic 형식으로 변환 → 프론트엔드 코드 수정 불필요
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
