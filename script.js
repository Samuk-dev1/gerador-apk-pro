// Adiciona o suporte para o botão voltar do celular navegar no histórico do painel
window.addEventListener('popstate', function (event) {
    // Mantém o histórico sincronizado
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'BrowserBack' || event.keyCode === 8) {
        if (window.history.length > 1) {
            window.history.back();
        }
    }
});