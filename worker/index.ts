import {presenceRoute} from '../lib/presence-service';
import {workflowRoute} from "../lib/workflow-route";
import {runScheduledWork} from "../lib/automation-service";
import {operationalRoute} from "../lib/operational-route";
import {accountRecoveryRoute} from "../lib/account-recovery";
import {googleRoute,googleReady} from "../lib/google-login";
import {mailReady} from "../lib/mail-service";
import {reportScheduleRoute,runReports} from "../lib/scheduled-reports";
import {fieldTransformRoute} from "../lib/field-transform";
import {idempotentResponse} from "../lib/idempotency";
import {webhookRoute,deliverWebhooks} from "../lib/webhooks";
import {hierarchyTemplateRoute} from "../lib/hierarchy-templates";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { workspaceBrandingRoute } from "../lib/workspace-branding-service";
import { dashboardRoute } from "../lib/dashboard-service";
import { viewPreferenceRoute } from "../lib/view-preference-service";
import { integrationRoute } from "../lib/integration-access";
import { changeTargets, recordChanges, changesResponse } from "../lib/collaboration";
import { publicAccess, privateResponse } from "../lib/public-access";

import { loadActor, teamRoute, isPublicAuth } from "../lib/team-service";
import { withActor, AccessError } from "../lib/access-context";
import { authorizeResourceRequest } from "../lib/request-access";
import { customFieldRoute } from "../lib/custom-field-service";

const worker = {
  async scheduled(_controller:ScheduledController,env:Cloudflare.Env,ctx:ExecutionContext){if(env.DB)ctx.waitUntil(Promise.all([runScheduledWork(env.DB),runReports(env.DB,env),deliverWebhooks(env.DB)]));},
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const url = new URL(request.url);
    if(url.pathname.startsWith("/api/v1/")){url.pathname=url.pathname.replace("/api/v1/","/api/");request=new Request(url,request);}
    if (url.pathname.replace(/\/$/, "") === "/lab-report")
      return privateResponse(new Response("Not found", { status: 404 }));
    const access = publicAccess(url.pathname);
    if (access === "asset") {
      return env.ASSETS?.fetch(request) ?? new Response("Not found", { status: 404 });
    }
    if (!env.DB) return privateResponse(Response.json({error:"Espacio no disponible."},{status:503}));
    const loaded = await loadActor(env.DB, request);
    const isMcp=url.pathname==='/mcp'||url.pathname==='/api/integrations/mcp';
    const actor=loaded?{...loaded,channel:(isMcp?'mcp':loaded.kind==='token'?'api':'web') as 'mcp'|'api'|'web'}:null;
    if(url.pathname==='/api/auth/capabilities')return privateResponse(Response.json({google:googleReady(env),email:mailReady(env)}));
    const presence=await presenceRoute(request,env.DB,actor);if(presence)return privateResponse(presence);
    const recovery=await accountRecoveryRoute(request,env.DB,env);if(recovery)return privateResponse(recovery);
    const google=await googleRoute(request,env.DB,actor,env);if(google)return privateResponse(google);
    const reportSchedule=await reportScheduleRoute(request,env.DB,actor,env);if(reportSchedule)return privateResponse(reportSchedule);
    const workflow=await workflowRoute(request,env.DB,actor,env.SAV3_JOB_SECRET);if(workflow)return privateResponse(workflow);
    const operation=await operationalRoute(request,env.DB,env.BUCKET,actor,env.ASSETS);if(operation)return privateResponse(operation);
    const transform=await fieldTransformRoute(request,env.DB,actor);if(transform)return privateResponse(transform);
    const customFields = await customFieldRoute(request,env.DB,actor);
    if(customFields)return privateResponse(customFields);
    const branding=await workspaceBrandingRoute(request,env.DB,env.BUCKET,actor);
    if(branding)return privateResponse(branding);
    const webhook=await webhookRoute(request,env.DB,actor);if(webhook)return privateResponse(webhook);
    const hierarchyTemplate=await hierarchyTemplateRoute(request,env.DB,actor);if(hierarchyTemplate)return privateResponse(hierarchyTemplate);
    const integration=await integrationRoute(request,env.DB,actor);
    if(integration)return privateResponse(integration);
    const preferenceResponse=await viewPreferenceRoute(request,env.DB,actor);
    if(preferenceResponse)return privateResponse(preferenceResponse);
    const dashboardResponse = await dashboardRoute(request,env.DB,actor);
    if(dashboardResponse)return privateResponse(dashboardResponse);
    const teamResponse = await teamRoute(request, env.DB, actor,env);
    if (teamResponse) return privateResponse(teamResponse);
    if (access !== "page" && !isPublicAuth(url.pathname)) {
      if (!actor) {
        if (request.headers.get("Accept")?.includes("text/html")) return privateResponse(Response.redirect(new URL("/login",url),303));
        return privateResponse(Response.json({error:"Iniciá sesión para acceder."},{status:401}));
      }
      try { await authorizeResourceRequest(request, env.DB, actor); }
      catch(e) { if(e instanceof AccessError) return privateResponse(Response.json({error:e.message},{status:e.status})); throw e; }
      if (url.pathname === "/api/restore" && request.method === "GET" && !actor.access.admin) return privateResponse(Response.json({complete:true,cursor:1,total:1}));
      if (url.pathname.startsWith("/restored-files/")) return privateResponse(await env.ASSETS?.fetch(request) ?? new Response("Not found",{status:404}));
    }
    if(url.pathname==='/api/changes'&&actor&&request.method==='GET')return privateResponse(await changesResponse(request,env.DB,actor));
    const targets=actor?await changeTargets(request,env.DB,actor):[];
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const run = () => runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    const response = actor ? await withActor(actor, ()=>idempotentResponse(request,env.DB!,actor,run)) : await run();
    if(actor&&targets.length&&!response.headers.has("X-Idempotent-Replay")){await recordChanges(env.DB,actor,targets,response,request);ctx.waitUntil(deliverWebhooks(env.DB));}
    return privateResponse(response);
  },
};

export default worker;
