window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('app-view');
    
    // Cria o iframe de forma programática para garantir permissões de sessão
    const iframe = document.createElement('iframe');
    iframe.src = 'https://tpanel.criarsite.online/index.php';
    iframe.setAttribute('allow', 'fullscreen; camera; microphone; geolocation; cookies');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    
    container.appendChild(iframe);
});