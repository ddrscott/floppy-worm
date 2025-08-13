# Welcome to Remix!

- 📖 [Remix docs](https://remix.run/docs)

## Development

Run the dev server:

```sh
npm run dev
```

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying Node applications, the built-in Remix app server is production-ready.

Make sure to deploy the output of `npm run build`

- `build/server`
- `build/client`

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever css framework you prefer. See the [Vite docs on css](https://vitejs.dev/guide/features.html#css) for more information.


## Levels/Maps

Levels are organized in the following structure:
`./levels/{$order}-{$category}/{$order}-{$mapKey}.json`

This will allow `MapDataRegistry` to load and sort levels automatically.
- `{$order}`: A number to determine the order of categories and maps.
- `{$category}`: A string to group maps into categories.
- `{$mapKey}`: A unique string identifier for each map.
