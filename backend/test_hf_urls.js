require('dotenv').config();
const key = process.env.HUGGINGFACE_API_KEY || 'your_hf_token_here';
(async () => {
  for (const url of [
    'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-3.5-large',
    'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
    'https://api-inference.huggingface.co/models/prompthero/openjourney'
  ]) {
    console.log('Testing', url);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: 'a robot' })
    });
    console.log(res.status, res.headers.get('content-type'));
    if (!res.ok) console.log(await res.text().then(t => t.substring(0, 100)));
  }
})()
