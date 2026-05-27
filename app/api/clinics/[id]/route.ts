// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { NextRequest, NextResponse } from "next/server";
// import { authenticate, requireRole } from "@/lib/auth/middleware";
// import { updateClinicSchema } from "@/lib/validations/clinic.schema";
// import { getClinic, updateClinic } from "@/lib/services/clinic.service";

// type Params = { params: { id: string } };

// export async function GET(req: NextRequest, { params }: Params) {
//   const { error } = authenticate(req);
//   if (error) return error;
//   const { id } = await params;

//   try {
//     const clinic = await getClinic(id);
//     return NextResponse.json({ clinic });
//   } catch (err: any) {
//     return NextResponse.json({ error: err.message }, { status: 404 });
//   }
// }

// export async function PATCH(req: NextRequest, { params }: Params) {
//   const { payload, error } = authenticate(req);
//   if (error) return error;

//   const { id } = await params;
//   const roleError = requireRole(payload!.role, ["admin"]);
//   if (roleError) return roleError;

//   try {
//     const body = await req.json();
//     const parsed = updateClinicSchema.safeParse(body);
//     if (!parsed.success) {
//       return NextResponse.json(
//         { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
//         { status: 400 },
//       );
//     }

//     const clinic = await updateClinic(id, payload!.userId, parsed.data);
//     return NextResponse.json({ clinic });
//   } catch (err: any) {
//     return NextResponse.json({ error: err.message }, { status: 400 });
//   }
// }
