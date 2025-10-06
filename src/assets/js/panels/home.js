/**
 * @author Darken
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
import { config, database, logger, changePanel, appdata, setStatus, pkg, popup } from '../utils.js'

const { Launch } = require('minecraft-java-core')
const { shell, ipcRenderer } = require('electron')
const { app, BrowserWindow, ipcMain } = require('electron');

class Home {
    static id = "home";

    async init(config) {
        this.config = config;
        this.db = new database();
        this.news();
        this.socialLick();
        this.instancesSelect();
        document.querySelector('.settings-btn').addEventListener('click', e => changePanel('settings'));
    }

    async news() {
        let newsElement = document.querySelector('.news-list');
        let news = await config.getNews().then(res => res).catch(err => false);

        if (news) {
            if (!news.length) {
                let blockNews = document.createElement('div');
                blockNews.classList.add('news-block');
                blockNews.innerHTML = `
                    <div class="news-header">
                        <img class="server-status-icon" src="assets/images/icon.png">
                        <div class="header-text">
                            <div class="title">No hay noticias disponibles actualmente.</div>
                        </div>
                        <div class="date">
                            <div class="day">25</div>
                            <div class="month">Abril</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>Puedes seguir todas las novedades relativas al servidor aquí.</p>
                        </div>
                    </div>`;
                newsElement.appendChild(blockNews);
            } else {
                for (let News of news) {
                    let date = this.getdate(News.publish_date);
                    let blockNews = document.createElement('div');
                    blockNews.classList.add('news-block');
                    blockNews.innerHTML = `
                        <div class="news-header">
                            <img class="server-status-icon" src="assets/images/icon.png">
                            <div class="header-text">
                                <div class="title">${News.title}</div>
                            </div>
                            <div class="date">
                                <div class="day">${date.day}</div>
                                <div class="month">${date.month}</div>
                            </div>
                        </div>
                        <div class="news-content">
                            <div class="bbWrapper">
                                <p>${News.content.replace(/\n/g, '<br>')}</p>
                                <p class="news-author">- <span>${News.author}</span></p>
                            </div>
                        </div>`;
                    newsElement.appendChild(blockNews);
                }
            }
        } else {
            let blockNews = document.createElement('div');
            blockNews.classList.add('news-block');
            blockNews.innerHTML = `
                <div class="news-header">
                        <img class="server-status-icon" src="assets/images/icon.png">
                        <div class="header-text">
                            <div class="title">Error.</div>
                        </div>
                        <div class="date">
                            <div class="day">25</div>
                            <div class="month">Abril</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>No se puede contactar con el servidor de noticias.</br>Por favor verifique su configuración.</p>
                        </div>
                    </div>`
            newsElement.appendChild(blockNews);
        }
    }

    socialLick() {
        let socials = document.querySelectorAll('.social-block');
        socials.forEach(social => {
            social.addEventListener('click', e => shell.openExternal(social.dataset.url));
        });
    }

    async instancesSelect() {
        let configClient = await this.db.readData('configClient');
        let auth = await this.db.readData('accounts', configClient.account_selected);
        let instancesList = await config.getInstanceList();
        let instanceSelect = instancesList.find(i => i.name == configClient?.instance_selct)
            ? configClient?.instance_selct
            : null;

        let playBTN = document.querySelector('.play-btn');
        let instanceBTN = document.querySelector('.instance-select');
        let instancePopup = document.querySelector('.instance-popup');
        let instancesListPopup = document.querySelector('.instances-List');
        let instanceCloseBTN = document.querySelector('.close-popup');

        // Siempre mostrar el botón de instancias
        instanceBTN.style.display = 'flex';

        if (!instanceSelect) {
            let newInstanceSelect = instancesList.find(i => !i.whitelistActive) || instancesList[0];
            configClient.instance_selct = newInstanceSelect?.name;
            instanceSelect = newInstanceSelect?.name;
            await this.db.updateData('configClient', configClient);
        }

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(w => w === auth?.name);
                if (whitelist !== auth?.name && instance.name === instanceSelect) {
                    let newInstanceSelect = instancesList.find(i => !i.whitelistActive) || instancesList[0];
                    configClient.instance_selct = newInstanceSelect?.name;
                    instanceSelect = newInstanceSelect?.name;
                    setStatus(newInstanceSelect?.status);
                    await this.db.updateData('configClient', configClient);
                }
            } else if (instance.name === instanceSelect) setStatus(instance.status);
        }

        // Botón selector de instancia abre popup
        instanceBTN.addEventListener('click', async () => {
            instancesListPopup.innerHTML = '';

            let availableInstances = instancesList.filter(instance => {
                if (instance.whitelistActive) {
                    return instance.whitelist.includes(auth?.name);
                }
                return true;
            });

            if (availableInstances.length === 0) {
                instancesListPopup.innerHTML = `<div class="no-instances">No hay instancias activas disponibles</div>`;
            } else {
                for (let instance of availableInstances) {
                    instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements${instance.name === instanceSelect ? ' active-instance' : ''}">${instance.name}</div>`;
                }
            }

            instancePopup.style.display = 'flex';
        });

        // Selección de instancia en popup
        instancePopup.addEventListener('click', async e => {
            if (e.target.classList.contains('instance-elements')) {
                let newInstanceSelect = e.target.id;
                let active = document.querySelector('.active-instance');
                if (active) active.classList.remove('active-instance');
                e.target.classList.add('active-instance');

                configClient.instance_selct = newInstanceSelect;
                await this.db.updateData('configClient', configClient);
                instanceSelect = newInstanceSelect;

                let options = instancesList.find(i => i.name === newInstanceSelect);
                await setStatus(options.status);
                instancePopup.style.display = 'none';
            }
        });

        // Cerrar popup
        instanceCloseBTN.addEventListener('click', () => instancePopup.style.display = 'none');

        // Botón Jugar
        playBTN.addEventListener('click', () => this.startGame());
    }

    async startGame() {
        let launch = new Launch();
        let configClient = await this.db.readData('configClient');
        let instance = await config.getInstanceList();
        let authenticator = await this.db.readData('accounts', configClient.account_selected);
        let options = instance.find(i => i.name === configClient.instance_selct);

        let playInstanceBTN = document.querySelector('.play-instance');
        let infoStartingBOX = document.querySelector('.info-starting-game');
        let infoStarting = document.querySelector(".info-starting-game-text");
        let progressBar = document.querySelector('.progress-bar');

        let opt = {
            url: options.url,
            authenticator,
            timeout: 10000,
            path: `${await appdata()}/${process.platform === 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`,
            instance: options.name,
            version: options.loadder.minecraft_version,
            detached: configClient.launcher_config.closeLauncher !== "close-all",
            downloadFileMultiple: configClient.launcher_config.download_multi,
            intelEnabledMac: configClient.launcher_config.intelEnabledMac,
            loader: {
                type: options.loadder.loadder_type,
                build: options.loadder.loadder_version,
                enable: options.loadder.loadder_type !== 'none'
            },
            verify: options.verify,
            ignored: [...options.ignored],
            javaPath: configClient.java_config.java_path,
            screen: {
                width: configClient.game_config.screen_size.width,
                height: configClient.game_config.screen_size.height
            },
            memory: {
                min: `${configClient.java_config.java_memory.min * 1024}M`,
                max: `${configClient.java_config.java_memory.max * 1024}M`
            }
        };

        launch.Launch(opt);

        playInstanceBTN.style.display = "none";
        infoStartingBOX.style.display = "block";
        progressBar.style.display = "";

        ipcRenderer.send('main-window-progress-load');

        launch.on('extract', extract => ipcRenderer.send('main-window-progress-load'));
        launch.on('progress', (progress, size) => {
            infoStarting.innerHTML = `Descargando ${((progress / size) * 100).toFixed(0)}%`;
            ipcRenderer.send('main-window-progress', { progress, size });
            progressBar.value = progress;
            progressBar.max = size;
        });
        launch.on('check', (progress, size) => {
            infoStarting.innerHTML = `Verificando ${((progress / size) * 100).toFixed(0)}%`;
            ipcRenderer.send('main-window-progress', { progress, size });
            progressBar.value = progress;
            progressBar.max = size;
        });
        launch.on('estimated', time => console.log(`Tiempo estimado: ${time}s`));
        launch.on('speed', speed => console.log(`${(speed / 1067008).toFixed(2)} Mb/s`));
        launch.on('patch', patch => infoStarting.innerHTML = `Parche en curso...`);
        launch.on('data', e => {
            progressBar.style.display = "none";
            infoStarting.innerHTML = `Arrancando...`;
            new logger('Minecraft', '#36b030');
        });
        launch.on('close', code => {
            ipcRenderer.send('main-window-progress-reset');
            infoStartingBOX.style.display = "none";
            playInstanceBTN.style.display = "flex";
            infoStarting.innerHTML = `Verificando`;
            new logger(pkg.name, '#7289da');
        });
        launch.on('error', err => {
            let popupError = new popup();
            popupError.openPopup({ title: 'Error', content: err.error, color: 'red', options: true });
            ipcRenderer.send('main-window-progress-reset');
            infoStartingBOX.style.display = "none";
            playInstanceBTN.style.display = "flex";
            infoStarting.innerHTML = `Verificando`;
            new logger(pkg.name, '#7289da');
        });
    }

    getdate(e) {
        let date = new Date(e);
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        let day = date.getDate();
        let allMonth = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return { year, month: allMonth[month - 1], day };
    }
}


export default Home;
