/**
 * Waline frontend UI page HTML
 * Returns the exact original Waline server root page
 */
export function getWalinePage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Waline Example</title>
</head>
<body>
  <div id="waline" style="max-width: 800px;margin: 0 auto;"></div>
  <link href='//unpkg.com/@waline/client@v3/dist/waline.css' rel='stylesheet' />
  <script type="module">
    import { init } from 'https://unpkg.com/@waline/client@v3/dist/waline.js';

    const params = new URLSearchParams(location.search.slice(1));
    const waline = init({
      el: '#waline',
      path: params.get('path') || '/',
      lang: params.get('lng') || undefined,
      serverURL: location.protocol + '//' + location.host + location.pathname.replace(/\\/+$/, ''),
      recaptchaV3Key: '',
      turnstileKey: '',
    });
  </script>
</body>
</html>`;
}
