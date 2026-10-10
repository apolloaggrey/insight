import type { MemberStatus, UserRole } from '@insight/shared/types';

export interface TeamMember {
	id: string;
	name: string;
	email: string;
	role: UserRole;
	status: MemberStatus;
}
