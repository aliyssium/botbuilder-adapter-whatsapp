# botbuilder-adapter-whatsapp

Connect [Botkit](https://www.npmjs.com/package/botkit) or [BotBuilder](https://www.npmjs.com/package/botbuilder) to
WhatsApp.

This package contains an adapter that communicates directly with the WhatsApp Client Interface, and translates messages
to and from a standard format used by your bot. This package can be used alongside your favorite bot development
framework to build bots that work with Whatsapp.

## Install Package

Add this package to your project using npm:

```bash
npm install --save botbuilder-adapter-whatsapp
```

Import the adapter class into your code:

```javascript
const { WhatsAppAdapter } = require('botbuilder-adapter-whatsapp');
```

## Get Started

If you are starting a brand new
project, [follow these instructions to create a customized application template.](../docs/index.md)

## Use WhatsAppAdapter in your App

WhatsAppAdapter provides a translation layer for Botkit and BotBuilder so that bot developers can connect to WhatsApp
and have access to WhatsApp's Client Interface.

### Botkit Basics

When used in concert with Botkit, developers need only pass the configured adapter to the Botkit constructor, as seen
below. Botkit will automatically create and configure the webhook endpoints and other options necessary for
communicating with WhatsApp.

Developers can then bind to Botkit's event emitting system using `controller.on` and `controller.hears` to filter and
handle incoming events from the messaging platform. [Learn more about Botkit's core feature &rarr;](../docs/index.md).

[A full description of the WhatsAppAdapter options and example code can be found in the class reference docs.](../docs/reference/whatsapp.md#create-a-new-whatsappadapter)

```javascript
const adapter = new WhatsAppAdapter({
	auth: process.env.WHATSAPP_AUTH
});

const controller = new Botkit({
	adapter,
	// ...other options
});

controller.on('message', async (bot, message) => {
	await bot.reply(message, 'I heard a message!');
});
```

### BotBuilder Basics

Alternately, developers may choose to use `WhatsAppAdapter` with BotBuilder. With BotBuilder, the adapter is used more
directly with a webserver, and all incoming events are handled
as [Activities](https://docs.microsoft.com/en-us/javascript/api/botframework-schema/activity?view=botbuilder-ts-latest).

```javascript
const { WhatsAppAdapter } = require('botbuilder-adapter-whatsapp');
const restify = require('restify');

const adapter = new WhatsAppAdapter({
	auth: process.env.WHATSAPP_AUTH
});

const server = restify.createServer();

server.post('/api/messages', (req, res) => {
	adapter.processActivity(req, res, async (context) => {
		await context.sendActivity('I heard a message!');
	});
});
```

## Botkit Extensions

In Botkit handlers, the `bot` worker for WhatsApp
contains [all of the base methods](../docs/reference/core.md#BotWorker) as well as the following platform-specific
extensions:

### [controller.getInstallLink()](../docs/reference/whatsapp.md#getinstalllink)

Returns the first step of an auth-flow that results in the Botkit application being enabled with WhatsApp.
