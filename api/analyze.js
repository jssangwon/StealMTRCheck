export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수가 없습니다.' });

  const { data, mediaType } = req.body;
  if (!data || !mediaType) return res.status(400).json({ error: '파일 데이터가 없습니다.' });

  const prompt = `You are a steel mill test certificate (MTC) data extractor. Output ONLY a single valid JSON object. No explanation, no preamble. Start with { and end with }.

Chemical unit conversion rules:
1. Standard wt% (0.0001~2.0): use as-is.
2. Entire table x1000 notation: divide ALL values by 1000.
3. Per-column digit code (2=x100, 3=x1000, 4=x10000, 5=x100000): divide each column accordingly.
4. Per-column text "X 1000" or "X 100": apply per column.
5. Abnormally large values with no notation: divide by 1000.
All chemical values must be wt% in range 0.0001~2.0.

Extract ALL thickness rows. If chemical is shared across thicknesses, copy into every dimension.

Output this JSON and nothing else:
{"steelGrade":"","manufacturer":"","heatNo":"","orderNo":"","dimensions":[{"thickness":"","chemical":{"C":null,"Si":null,"Mn":null,"P":null,"S":null,"Cu":null,"Ni":null,"Cr":null,"Mo":null,"V":null,"Nb":null,"Ti":null,"B":null,"Ceq":null},"mechanical":{"yieldStrength":null,"tensileStrength":null,"elongation":null,"charpy":null}}]}

Units: chemical=wt%, Strength=MPa, Elongation=%, Charpy=J. null if not found.

Now extract from this steel certificate:`;

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mediaType, data } }
          ]
        }],
        generationConfig: { maxOutputTokens: 1000, temperature: 0 }
      }),
    });

    const geminiData = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: geminiData?.error?.message || '알 수 없는 오류' });
    }

    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
