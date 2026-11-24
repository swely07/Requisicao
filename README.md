# EBJC Equipamentos
Protótipo escolar. Não ligado a um projeto real nem testado em produção.
1. Em js/firebase.js substitui firebaseConfig pelos dados públicos da aplicação Web Firebase existente.
2. Em Authentication ativa Email/Password. Um responsável deve criar/provisionar contas @ebjc.pt e verificar os emails. Não reutilizar palavras-passe Microsoft; este método não é SSO Microsoft.
3. Cria/abre Firestore e publica firestore.rules. Cria manualmente admins/{UID} para o responsável autorizado. Não publiques credenciais privadas.
4. Serve a pasta por HTTP local (por exemplo Live Server no VS Code). Testa com contas verificadas de administrador e aluno. Adiciona equipamentos pelo inventário; aprovar reserva uma unidade, entregar regista empréstimo, devolver liberta a unidade.
5. Publica a pasta na raiz do GitHub Pages, branch main, /(root). Autoriza o domínio em Authentication se necessário.
6. Testa isolamento de pedidos, domínio, permissões, stock e transições antes de usar dados reais.
Limites: esta versão segue o domínio e login pedidos pelo utilizador, não a whitelist de 18 alunos nem o OAuth Microsoft dos manuais. Confirma com a professora antes de entregar. As regras pressupõem administradores de confiança; não foram testadas no emulador. Não há edição de quantidades existentes nesta versão.
