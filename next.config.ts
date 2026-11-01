import type {NextConfig} from "next";
const config:NextConfig={async headers(){return [{source:"/:path*",headers:[{key:"X-Content-Type-Options",value:"nosniff"},{key:"Referrer-Policy",value:"strict-origin-when-cross-origin"}]},{source:"/restored-files/:path*",headers:[{key:"Content-Type",value:"application/octet-stream"},{key:"Content-Disposition",value:"attachment"}]}]}};
export default config;
