// Tratamento nativo do botão de voltar para histórico de páginas
window.addEventListener('popstate', function (event) {
    // Sincroniza o histórico de navegação
});

document.addEventListener('backbutton', function (e) {
    if (window.history.length > 1) {
        window.history.back();
    }
}, false);