require('dotenv').config();
(async () => {
  try {
    const res = await fetch('https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: 'a robot' })
    });
    console.log(res.status, res.headers.get('content-type'));
    if(!res.ok) console.log(await res.text());
  } catch(e) { console.error(e) }
})()
