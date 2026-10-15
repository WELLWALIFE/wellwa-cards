// Which release this page was built from. deploy.sh sets NEXT_PUBLIC_DEPLOY_ID (a timestamp) for every production build, so the code in a
// browser tab and the code on the server can be compared. Empty in `next dev`: nothing is compared there.
export const DEPLOY_ID = process.env.NEXT_PUBLIC_DEPLOY_ID ?? "";
