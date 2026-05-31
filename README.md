# Chatwork Message Scheduler

[日本語版 README はこちら](./README.ja.md)

A Chrome extension that schedules Chatwork messages to be sent automatically at a chosen date and time.

![demo](./docs/demo.png)

## Features

- Schedule a message to be sent at a specified date and time
- Pick the target room from a list, or grab the room you currently have open in one click
- View, edit, delete, and send-now your scheduled messages
- Reservations persist across browser and PC restarts

## Installation

1. Clone this repository
2. Run `pnpm install && pnpm build`
3. Open `chrome://extensions`
4. Enable **Developer mode**
5. Click **Load unpacked** and select the `dist` directory

## Usage

1. Open the side panel from the extension icon
2. Issue a [Chatwork API token](https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php) and save it in the panel
3. Choose the target room, date/time, and message body, then schedule it
4. The message is sent automatically at the scheduled time; check its status in the list

## Notes

- Messages are sent only while Chrome is running. A reservation whose time passes while Chrome is closed is sent the next time Chrome starts.
- The scheduled time is interpreted in your device's local timezone.
- A Chatwork API token is required.

## Development

See [CLAUDE.md](./CLAUDE.md).

## License

[MIT](./LICENSE)
