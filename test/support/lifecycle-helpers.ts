import { TestContext, TestUser, applicationPayload, auth, waitFor } from './test-app';

// Shared steps that drive an application through the lifecycle over real HTTP.

export async function createApplication(
  ctx: TestContext,
  owner: TestUser,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const response = await ctx.http
    .post('/api/merchant-applications')
    .set(auth(owner))
    .send(applicationPayload(overrides))
    .expect(201);
  return response.body.id;
}

export async function getAsAdmin(ctx: TestContext, admin: TestUser, id: string) {
  const response = await ctx.http.get(`/api/merchant-applications/${id}`).set(auth(admin)).expect(200);
  return response.body;
}

export async function submitAndAwaitRisk(
  ctx: TestContext,
  owner: TestUser,
  admin: TestUser,
  id: string,
): Promise<Record<string, unknown>> {
  await ctx.http.post(`/api/merchant-applications/${id}/submit`).set(auth(owner)).expect(202);
  return waitFor(
    () => getAsAdmin(ctx, admin, id),
    (body) => body.status === 'UNDER_REVIEW',
  );
}

export async function prepareUnderReview(
  ctx: TestContext,
  owner: TestUser,
  admin: TestUser,
  reviewer: TestUser,
): Promise<string> {
  const id = await createApplication(ctx, owner);
  await submitAndAwaitRisk(ctx, owner, admin, id);
  await ctx.http
    .put(`/api/merchant-applications/${id}/reviewer`)
    .set(auth(admin))
    .send({ reviewerId: reviewer.id })
    .expect(200);
  return id;
}
