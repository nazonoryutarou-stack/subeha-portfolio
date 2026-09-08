try {
  const {startArchitecture}=await import('./main.js');
  await startArchitecture();
} catch (error) {
  console.error('Astra Architecture could not start',error);
  const message=document.getElementById('load-error');
  message.hidden=false;
  message.textContent=/WebGL|context/i.test(String(error))
    ? '3D表示を開始できませんでした。WebGL 2が利用できるブラウザで開いてください。'
    : '事務所を表示できませんでした。接続を確認して、もう一度お試しください。';
  const button=document.getElementById('enter');
  button.textContent='読み直す';button.disabled=false;
  button.onclick=()=>location.reload();
}
