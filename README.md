# Child Attendance Sync

"I need to connect this app to Make.com via a webhook. When an usher clicks the Check In or Check Out button for a child, please trigger a standard fetch POST request to my Make.com webhook URL: https://hook.eu1.make.com/e6wgowgxjcqbwujwuuep2hqbkrslsxfo The payload sent to Make.com must be a JSON object containing:childId: The unique ID of the childchildName: The child's full nameparentName: The parent's full nameparentPhone: The parent's contact numberactionType: Either "Check In" or "Check Out" depending on which button was clickedtimestamp: The current date and time"

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://jesuschristhopeofgloryministries.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/758ad0fd-1d66-4da3-99b6-a1ed21e76706).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
