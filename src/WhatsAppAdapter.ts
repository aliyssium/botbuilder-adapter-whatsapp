/**
 * @module botbuilder-adapter-whatsapp
 */

import { Activity, ActivityTypes, BotAdapter, ConversationReference, ResourceResponse, TurnContext } from 'botbuilder';
import makeWASocket, {
	AuthenticationCreds,
	AuthenticationState,
	DisconnectReason, initAuthCreds, proto, SignalDataTypeMap
} from '@adiwajshing/baileys';
import { Boom } from '@hapi/boom';
import { WhatsAppClient } from './utils/WhatsAppClient';
import { Botkit } from 'botkit';

/**
 * Connect [Botkit](https://www.npmjs.com/package/botkit) or [BotBuilder](https://www.npmjs.com/package/botbuilder) to
 * Whatsapp.
 */
export class WhatsAppAdapter extends BotAdapter {
	/**
	 * Name used by Botkit plugin loader
	 * @ignore
	 */
	public name = 'WhatsApp Adapter';
	private options: IWhatsAppAdapterOptions;
	private whatsapp: WhatsAppClient | undefined;
	private KEY_MAP: { [T in keyof SignalDataTypeMap]: string } = {
		'pre-key': 'preKeys',
		'session': 'sessions',
		'sender-key': 'senderKeys',
		'app-state-sync-key': 'appStateSyncKeys',
		'app-state-sync-version': 'appStateVersions',
		'sender-key-memory': 'senderKeyMemory'
	};

	/**
	 * Create a WhatsApp adapter.
	 * @param options An object containing API credentials, a webhook verification token and other options
	 */
	public constructor(options: IWhatsAppAdapterOptions) {
		super();

		this.options = options;

		/*
		 * Check for auth options.
		 */
		if (!this.options.auth) {
			const warning = [
				'',
				'****************************************************************************************',
				'* WARNING: Your bot is operating without recommended security mechanisms in place.     *',
				'* Initialize your adapter with an auth parameter to enable                             *',
				'* verification that all incoming webhooks originate with Slack:                        *',
				'*                                                                                      *',
				'* var adapter = new WhatsAppAdapter({auth: <my auth config from whatsapp>});           *',
				'*                                                                                      *',
				'****************************************************************************************',
				'>> WABailey docs: https://adiwajshing.github.io/Baileys/',
				''
			];
			console.warn(warning.join('\n'));
			if (!this.options.enableIncomplete) {
				throw new Error('Required: include a auth to verify incoming Events API webhooks');
			}
		}

		if (this.options.enableIncomplete) {
			const warning = [
				'',
				'****************************************************************************************',
				'* WARNING: Your adapter may be running with an incomplete/unsafe configuration.        *',
				'* - Ensure all required configuration options are present                              *',
				'* - Disable the "enable_incomplete" option!                                            *',
				'****************************************************************************************',
				''
			];
			console.warn(warning.join('\n'));
		}
	}

	/**
	 * Botkit-only: Initialization function called automatically when used with Botkit.
	 * Calls createSocketServer to bind a websocket listener to Botkit's pre-existing webserver.
	 * @param botkit
	 */
	public init(botkit: Botkit): void {
		// when the bot is ready, register the webhook subscription with the Whatsapp Socket API
		botkit.ready(() => {
			this.createSocketServer(botkit.handleTurn.bind(botkit));
		});
	}

	/**
	 * Note: Create the server using WABaileys makeWASocket
	 * @param logic a turn handler function in the form `async(context)=>{ ... }` that will handle the bot's logic.
	 */
	public createSocketServer(logic: (turnContext: TurnContext) => Promise<any>): void {

		const { state, saveState } = this.updateAuthState();

		this.whatsapp = makeWASocket({
			auth: state
		});

		this.whatsapp.ev.on('messages.set', async ({ messages }) => {
			for (let i = 0; i < messages.length; i++) {
				const message = messages[i];
				const activity: Activity = {
					id: message.key.id || undefined,
					callerId: '',
					label: '',
					listenFor: [],
					localTimezone: '',
					serviceUrl: '',
					valueType: '',
					timestamp: message.messageTimestamp,
					channelId: 'whatsapp',
					conversation: {
						id: message.key.remoteJid || '',
						isGroup: message.key.remoteJid?.endsWith('@g.us') || false,
						name: '',
						conversationType: 'default'
					},
					from: {
						id: message.key.fromMe ? '<yourphonenumber>@s.whatsapp.net' : message.key.participant || message.key.remoteJid || '',
						name: message.pushName || ''
					},
					recipient: {
						id: message.key.remoteJid || '',
						name: ''
					},
					value: message,
					text: message.message?.conversation || message.message?.extendedTextMessage?.text || '',
					textFormat: 'markdown',
					type: ActivityTypes.Message
				};

				const context = new TurnContext(this, activity as Activity);
				this.runMiddleware(context, logic).catch((err) => { console.error(err.toString()); });
			}
		});

		this.whatsapp.ev.on('connection.update', async (update) => {
			if (update.qr) {
				this.options.qr = update.qr;
			}
			const { connection, lastDisconnect } = update;
			if (connection === 'close') {
				const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
				console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
				// reconnect if not logged out
				if (shouldReconnect) {
					this.createSocketServer(logic);
				}
			} else if (connection === 'open') {
				console.log('opened connection');
			}
		});

		this.whatsapp.ev.on('creds.update', saveState);

	}

	/**
	 * Get the oauth link for this bot, based on the clientId and scopes passed in to the constructor.
	 *
	 * @returns The QR Code Whatsapp sends to the user on login
	 */
	public getInstallData(): string {
		if (this.options.qr) {
			return this.options.qr;
		} else {
			throw new Error('getInstallLink() cannot be called without qr in adapter options');
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public continueConversation(reference: Partial<ConversationReference>, logic: (revocableContext: TurnContext) => Promise<void>): Promise<void> {
		return Promise.resolve(undefined);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public deleteActivity(context: TurnContext, reference: Partial<ConversationReference>): Promise<void> {
		return Promise.resolve(undefined);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public sendActivities(context: TurnContext, activities: Partial<Activity>[]): Promise<ResourceResponse[]> {
		return Promise.resolve([]);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public updateActivity(context: TurnContext, activity: Partial<Activity>): Promise<ResourceResponse | void> {
		return Promise.resolve(undefined);
	}

	private updateAuthState = (): { state: AuthenticationState, saveState: () => void } => {
		let creds: AuthenticationCreds;
		let keys: any = {};

		// save the authentication state to a file
		const saveState = () => {
			this.options.auth = { creds, keys };
		};

		if (this.options.auth) {
			creds = this.options.auth.creds;
			keys = this.options.auth.keys;
		} else {
			creds = initAuthCreds();
			keys = {};
		}

		return {
			state: {
				creds,
				keys: {
					get: (type, ids) => {
						const key = this.KEY_MAP[type];
						return ids.reduce(
							(dict: Record<string, unknown>, id) => {
								let value = keys[key]?.[id];
								if (value) {
									if (type === 'app-state-sync-key') {
										value = proto.AppStateSyncKeyData.fromObject(value);
									}

									dict[id] = value;
								}

								return dict;
							}, {}
						);
					},
					set: (data: Record<string, unknown>) => {
						for (const dataKey in data) {
							const key = this.KEY_MAP[dataKey as keyof SignalDataTypeMap];
							keys[key] = keys[key] || {};
							Object.assign(keys[key], data[dataKey]);
						}

						saveState();
					}
				}
			},
			saveState
		};
	};
}

/**
 * This interface defines the options that can be passed into the SlackAdapter constructor function.
 */
export interface IWhatsAppAdapterOptions {
	/**
	 * Authentication Data for the connection to the WhatsApp Client
	 */
	auth?: AuthenticationState;

	/**
	 * QR Data for the connection to the WhatsApp Client
	 */
	qr?: string;

	/**
	 * Allow the adapter to startup without a complete configuration.
	 * This is risky as it may result in a non-functioning or insecure adapter.
	 * This should only be used when getting started.
	 */
	enableIncomplete?: boolean;
}
