const { AZauth, Mojang } = require('minecraft-java-core');
const { ipcRenderer } = require('electron');
import { popup, database, changePanel, accountSelect, addAccount, config, setStatus } from '../utils.js';

class Login {
    static id = "login";

    async init(config) {
        this.config = config;
        this.db = new database();

        // Mostrar panel principal
        this.showTab('.login-select');

        // Selección de login
        document.querySelector('.select-microsoft').addEventListener('click', () => this.showMicrosoftLogin());
        document.querySelector('.select-offline').addEventListener('click', () => this.showOfflineLogin());

        // Botones de cancelar
        const cancels = [
            '.cancel-home',
            '.cancel-offline',
            '.cancel-AZauth',
            '.cancel-AZauth-A2F'
        ];
        cancels.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) el.addEventListener('click', () => this.showTab('.login-select'));
        });
    }

    // Mostrar pestañas de login
    showTab(selector) {
        document.querySelectorAll('.login-tabs').forEach(tab => tab.style.display = 'none');
        const active = document.querySelector(selector);
        if (active) active.style.display = 'block';
    }

    showMicrosoftLogin() {
        this.showTab('.login-home');
        this.getMicrosoft();
    }

    showOfflineLogin() {
        this.showTab('.login-offline');
        this.getCrack();
    }

    // === MICROSOFT LOGIN ===
    async getMicrosoft() {
        console.log('Iniciando login de Microsoft...');
        const popupLogin = new popup();
        const microsoftBtn = document.querySelector('.connect-home');

        // Evitar listeners duplicados
        microsoftBtn.replaceWith(microsoftBtn.cloneNode(true));
        const btn = document.querySelector('.connect-home');

        btn.addEventListener("click", async () => {
            popupLogin.openPopup({
                title: 'Conectando a Microsoft...',
                content: 'Por favor, espera unos segundos.',
                color: 'var(--color)'
            });

            try {
                const account_connect = await ipcRenderer.invoke('Microsoft-window', this.config.client_id);

                if (!account_connect || account_connect === 'cancel') {
                    popupLogin.closePopup();
                    return;
                }

                // Validar que tenga nombre
                if (!account_connect.name && account_connect.profile?.name) {
                    account_connect.name = account_connect.profile.name;
                }

                if (!account_connect.name) {
                    popupLogin.openPopup({
                        title: 'Error',
                        content: 'No se pudo obtener tu nombre de usuario de Minecraft.',
                        options: true
                    });
                    return;
                }

                console.log('Cuenta Microsoft conectada:', account_connect.name);
                await this.saveData(account_connect);
                popupLogin.closePopup();

            } catch (err) {
                popupLogin.openPopup({
                    title: 'Error de inicio de sesión',
                    content: err.message || err,
                    options: true
                });
            }
        });
    }

    // === OFFLINE LOGIN ===
    async getCrack() {
        console.log('Iniciando login Offline...');
        const popupLogin = new popup();
        const emailOffline = document.querySelector('.email-offline');
        const connectOffline = document.querySelector('.connect-offline');

        // Evitar listeners duplicados
        connectOffline.replaceWith(connectOffline.cloneNode(true));
        const btn = document.querySelector('.connect-offline');

        btn.addEventListener('click', async () => {
            const nick = emailOffline.value.trim();

            if (nick.length < 3) {
                popupLogin.openPopup({
                    title: 'Error',
                    content: 'Tu nick debe tener al menos 3 caracteres.',
                    options: true
                });
                return;
            }

            if (nick.includes(' ')) {
                popupLogin.openPopup({
                    title: 'Error',
                    content: 'Tu nick no debe contener espacios.',
                    options: true
                });
                return;
            }

            try {
                const MojangConnect = await Mojang.login(nick);
                if (MojangConnect.error) {
                    popupLogin.openPopup({
                        title: 'Error',
                        content: MojangConnect.message,
                        options: true
                    });
                    return;
                }

                await this.saveData(MojangConnect);
                popupLogin.closePopup();

            } catch (err) {
                popupLogin.openPopup({
                    title: 'Error',
                    content: err.message || 'Error desconocido al iniciar sesión offline.',
                    options: true
                });
            }
        });
    }

    // === AZAUTH LOGIN (si usas este sistema) ===
    async getAZauth() {
        // Puedes mantener tu lógica AZauth aquí si la tienes configurada
    }

    // === GUARDAR DATOS DE LA CUENTA ===
    async saveData(connectionData) {
        const configClient = await this.db.readData('configClient');
        const account = await this.db.createData('accounts', connectionData);
        const instanceSelect = configClient.instance_selct;
        const instancesList = await config.getInstanceList();

        configClient.account_selected = account.ID;

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                const whitelisted = instance.whitelist.find(u => u === account.name);
                if (!whitelisted && instance.name === instanceSelect) {
                    const newInstanceSelect = instancesList.find(i => !i.whitelistActive);
                    if (newInstanceSelect) {
                        configClient.instance_selct = newInstanceSelect.name;
                        await setStatus(newInstanceSelect.status);
                    }
                }
            }
        }

        await this.db.updateData('configClient', configClient);
        await addAccount(account);
        await accountSelect(account);
        changePanel('home');
    }
}

export default Login;
