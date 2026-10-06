import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getProject, projectDetailKeys } from '@/api/projectDetail'
import { useAuth } from '@/app/authContext'
import { can, normalizeRole, type ProjectAction, type ProjectRole } from '@/domain/roles'

/** Numeric id of the project in the URL, or null when it is not a number. */
export function useProjectId(): number | null {
  const { projectId } = useParams()
  const id = Number(projectId)
  return Number.isInteger(id) && id > 0 ? id : null
}

/** Loads the project in the URL. 403 and 404 both surface as an error the shell renders as "not available". */
export function useProject() {
  const id = useProjectId()
  const query = useQuery({
    queryKey: projectDetailKeys.detail(id ?? 0),
    queryFn: ({ signal }) => getProject(id!, signal),
    enabled: id !== null,
  })
  const { user } = useAuth()
  const project = query.data

  // The owner is identified by owner_id; other members by their membership row.
  let role: ProjectRole | null = null
  if (project && user) {
    if (project.owner_id === user.id) role = 'owner'
    else role = normalizeRole(project.memberships?.find((m) => m.user_id === user.id)?.role)
  }

  return {
    id,
    query,
    project,
    role,
    can: (action: ProjectAction) => can(role, action),
  }
}
