import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { accountPreferences } from '@/app/accountPreferences'
import { envelope, renderApp } from '@/test/helpers'
import { server } from '@/test/server'

const ok = (data: unknown = null, status = 200) => HttpResponse.json(envelope(data), { status })
const fail = (status: number, code: string, message: string, details: unknown = []) => HttpResponse.json({ success: false, error: { code, message, details } }, { status })

interface Apis {
  me?: Record<string, unknown>
  sessions?: Record<string, unknown>[]
  notifications?: Record<string, unknown>
  profile?: (body: Record<string, unknown>) => Response | undefined
  password?: () => Response | undefined
  mfa?: { enroll?: () => Response | undefined; confirm?: () => Response | undefined; disable?: () => Response | undefined }
  close?: () => Response | undefined
  notify?: (body: Record<string, unknown>) => Response | undefined
}

/** The signed-in account as a mutable record, so a save is visible on the next read like it is on the server. */
function mockAccount(o: Apis = {}) {
  const me: Record<string, unknown> = {
    id: 142,
    display_name: 'Shilan Rashid',
    email: 'shilan@example.org',
    status: 'approved',
    preferred_language: 'en',
    roles: ['researcher'],
    is_admin: false,
    mfa_enabled: false,
    profile: { affiliation: null, biography: 'لێکۆڵەری فەرموودە', research_interests: ['Takhrīj', 'Narrator criticism'], is_public: false, public_fields: ['research_interests', 'affiliation', 'biography'], display_preferences: null },
    display_preferences: { default_content_language: 'ar', numerals: 'eastern_arabic', calendar: 'gregorian_hijri', time_zone: 'UTC' },
    stats: { owned_projects_count: 4, memberships_count: 2, library_items_count: 9 },
    ...o.me,
  }
  const sessions = o.sessions ?? [
    { id: 1, name: 'auth-token', device: 'Web Browser', last_used_at: '2026-10-06T09:00:00Z', created_at: '2026-10-05T09:05:00Z', current: true },
    { id: 2, name: 'auth-token', device: 'Web Browser', last_used_at: '2026-10-04T11:38:00Z', created_at: '2026-10-04T11:00:00Z', current: false },
  ]
  const notifications: Record<string, unknown> = {
    notify_exports: true,
    notify_search_runs: true,
    notify_source_changes: true,
    notify_corpus_proposals: true,
    notify_invitations: true,
    notify_mentions: true,
    notify_assignments: true,
    notify_reviews: true,
    email_digest: 'instant',
    ...o.notifications,
  }
  const calls = {
    profile: [] as Record<string, unknown>[],
    password: [] as Record<string, unknown>[],
    notify: [] as Record<string, unknown>[],
    revoked: [] as string[],
    revokedOthers: 0,
    enrolled: 0,
    confirmed: [] as Record<string, unknown>[],
    disabled: [] as Record<string, unknown>[],
    closed: [] as Record<string, unknown>[],
  }
  server.use(
    http.get('*/api/v1/auth/me', () => ok(me)),
    http.patch('*/api/v1/auth/profile', async ({ request }) => {
      const body = (await request.json()) as Record<string, any>
      calls.profile.push(body)
      const custom = o.profile?.(body)
      if (custom) return custom
      const profile = { ...(me.profile as Record<string, unknown>) }
      for (const key of ['affiliation', 'biography', 'research_interests', 'is_public', 'public_fields', 'display_preferences']) if (key in body) profile[key] = body[key]
      me.profile = profile
      if (body.display_name) me.display_name = body.display_name
      if (body.preferred_language) me.preferred_language = body.preferred_language
      return ok(me)
    }),
    http.post('*/api/v1/auth/password/change', async ({ request }) => {
      calls.password.push((await request.json()) as Record<string, unknown>)
      return o.password?.() ?? ok()
    }),
    http.get('*/api/v1/auth/sessions', () => ok(sessions)),
    http.delete('*/api/v1/auth/sessions/:id', ({ params }) => {
      calls.revoked.push(String(params.id))
      const at = sessions.findIndex((s) => s.id === Number(params.id))
      if (at >= 0) sessions.splice(at, 1)
      return ok()
    }),
    http.delete('*/api/v1/auth/sessions', () => {
      calls.revokedOthers++
      for (let i = sessions.length - 1; i >= 0; i--) if (!sessions[i]!.current) sessions.splice(i, 1)
      return ok()
    }),
    http.post('*/api/v1/auth/mfa/enroll', () => {
      calls.enrolled++
      return o.mfa?.enroll?.() ?? ok({ secret: 'ABCDEFGHIJKLMNOP', otpauth_url: 'otpauth://totp/Hadith:shilan@example.org?secret=ABCDEFGHIJKLMNOP' })
    }),
    http.post('*/api/v1/auth/mfa/confirm', async ({ request }) => {
      calls.confirmed.push((await request.json()) as Record<string, unknown>)
      const custom = o.mfa?.confirm?.()
      if (custom) return custom
      me.mfa_enabled = true
      return ok({ mfa_enabled: true, recovery_codes: ['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC', 'DDDDDDDDDD', 'EEEEEEEEEE'] })
    }),
    http.post('*/api/v1/auth/mfa/disable', async ({ request }) => {
      calls.disabled.push((await request.json()) as Record<string, unknown>)
      const custom = o.mfa?.disable?.()
      if (custom) return custom
      me.mfa_enabled = false
      return ok({ mfa_enabled: false })
    }),
    http.get('*/api/v1/notifications/preferences', () => ok(notifications)),
    http.patch('*/api/v1/notifications/preferences', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.notify.push(body)
      const custom = o.notify?.(body)
      if (custom) return custom
      Object.assign(notifications, body)
      return ok(notifications)
    }),
    http.post('*/api/v1/auth/account/close', async ({ request }) => {
      calls.closed.push((await request.json()) as Record<string, unknown>)
      return o.close?.() ?? ok({ status: 'closure_requested', policy: 'x' })
    }),
  )
  return { calls, me }
}

const open = (tab = '') => renderApp(`/settings${tab ? `?tab=${tab}` : ''}`, { signedIn: true })

describe('Public profile', () => {
  it('shows what the account has, and says which parts are private', async () => {
    mockAccount()
    open()
    expect(await screen.findByDisplayValue('Shilan Rashid')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Takhrīj, Narrator criticism')).toBeInTheDocument()
    expect(screen.getByDisplayValue('لێکۆڵەری فەرموودە')).toBeInTheDocument()
    expect(screen.getByText(/shilan@example.org · Your email is private unless you choose to show it/)).toBeInTheDocument()
    expect(screen.getByText('Off. Nothing about you is public.')).toBeInTheDocument()
    expect(screen.getByText(/Your profile isn't public, so other visitors see nothing about you/)).toBeInTheDocument()
  })

  it('offers the fields to show only once the profile is public, and previews exactly what a visitor would see', async () => {
    mockAccount()
    open()
    const interests = await screen.findByRole('checkbox', { name: 'Research interests' })
    expect(interests).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: /Make my profile public/ }))
    expect(interests).toBeEnabled()
    const preview = screen.getByRole('region', { name: 'Public preview' })
    expect(within(preview).getByText('Takhrīj · Narrator criticism')).toBeInTheDocument()
    expect(within(preview).getByText('لێکۆڵەری فەرموودە')).toBeInTheDocument()
    expect(within(preview).getByText('Not provided')).toBeInTheDocument() // affiliation
    expect(within(preview).queryByText('shilan@example.org')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Email' }))
    expect(within(preview).getByText('shilan@example.org')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Biography' }))
    expect(within(preview).queryByText('لێکۆڵەری فەرموودە')).not.toBeInTheDocument()
  })

  it('saves what changed, with the interests as a list and the visible fields as a list of names', async () => {
    const { calls } = mockAccount()
    open()
    const name = await screen.findByLabelText(/Display name/)
    await userEvent.clear(name)
    await userEvent.type(name, 'Shilan R.')
    await userEvent.type(screen.getByRole('textbox', { name: /Affiliation/ }), 'Salahaddin University')
    await userEvent.click(screen.getByRole('checkbox', { name: /Make my profile public/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Email' }))
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(calls.profile).toEqual([
        {
          display_name: 'Shilan R.',
          affiliation: 'Salahaddin University',
          biography: 'لێکۆڵەری فەرموودە',
          research_interests: ['Takhrīj', 'Narrator criticism'],
          is_public: true,
          public_fields: ['research_interests', 'affiliation', 'biography', 'email'],
        },
      ]),
    )
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('sends an empty affiliation as nothing, not as an empty string', async () => {
    const { calls } = mockAccount({ me: { profile: { affiliation: 'Old', biography: null, research_interests: [], is_public: false, public_fields: null, display_preferences: null } } })
    open()
    const affiliation = await screen.findByRole('textbox', { name: /Affiliation/ })
    await userEvent.clear(affiliation)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(calls.profile[0]).toMatchObject({ affiliation: null, biography: null, research_interests: [] }))
  })

  it('needs a name, and sends nothing without one', async () => {
    const { calls } = mockAccount()
    open()
    const name = await screen.findByLabelText(/Display name/)
    await userEvent.clear(name)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Enter your name.')).toBeInTheDocument()
    expect(calls.profile).toHaveLength(0)
  })

  it('does not call a change saved when the server answered 200 but kept the old value', async () => {
    mockAccount({ profile: () => HttpResponse.json(envelope({ id: 142, display_name: 'Shilan Rashid', preferred_language: 'en', profile: { affiliation: null, biography: 'لێکۆڵەری فەرموودە', research_interests: ['Takhrīj', 'Narrator criticism'], is_public: false } })) })
    open()
    await userEvent.type(await screen.findByRole('textbox', { name: /Affiliation/ }), 'Somewhere')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("The changes weren't saved")
    expect(screen.getByRole('textbox', { name: /Affiliation/ })).toHaveValue('Somewhere')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })

  it('keeps an unsaved edit when the person looks at another tab and comes back', async () => {
    mockAccount()
    open()
    await userEvent.type(await screen.findByRole('textbox', { name: /Affiliation/ }), 'Kept text')
    await userEvent.click(screen.getByRole('tab', { name: 'Notifications' }))
    expect(screen.getByRole('tab', { name: 'Notifications' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'Public profile' }))
    expect(screen.getByRole('textbox', { name: /Affiliation/ })).toHaveValue('Kept text')
  })
})

describe('Language and display', () => {
  it('saves the interface language and the display choices, and the account’s numerals then take over', async () => {
    const { calls } = mockAccount()
    open('display')
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: /^Numerals/ }), 'western')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /^Calendar display/ }), 'gregorian')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /^Time zone/ }), 'Asia/Baghdad')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /^Default content language/ }), 'ckb')
    const preview = screen.getByRole('region', { name: 'Preview with these settings' })
    expect(within(preview).getByText('1,234,567')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(calls.profile).toEqual([
        { preferred_language: 'en', display_preferences: { default_content_language: 'ckb', numerals: 'western', calendar: 'gregorian', time_zone: 'Asia/Baghdad' } },
      ]),
    )
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('previews eastern Arabic numerals before they are saved', async () => {
    mockAccount()
    open('display')
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: /^Numerals/ }), 'eastern_arabic')
    expect(within(screen.getByRole('region', { name: 'Preview with these settings' })).getByText('١٬٢٣٤٬٥٦٧')).toBeInTheDocument()
  })

  it('says a display choice the server did not keep was not saved', async () => {
    mockAccount({ profile: () => HttpResponse.json(envelope({ id: 142, display_name: 'Shilan Rashid', preferred_language: 'en', profile: { display_preferences: null } })) })
    open('display')
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: /^Numerals/ }), 'eastern_arabic')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("The changes weren't saved")
  })
})

describe('accountPreferences', () => {
  it('is nothing until the person saved something, so the server’s defaults are not taken for a choice', () => {
    expect(accountPreferences(null)).toBeNull()
    expect(accountPreferences(undefined)).toBeNull()
  })
  it('reads the saved values, and falls back per field for one it does not understand', () => {
    expect(accountPreferences({ numerals: 'western', calendar: 'hijri_gregorian', time_zone: 'Asia/Baghdad', default_content_language: 'ckb' })).toEqual({
      numerals: 'western',
      calendar: 'hijri_gregorian',
      timeZone: 'Asia/Baghdad',
      contentLanguage: 'ckb',
    })
    expect(accountPreferences({ numerals: 'roman', calendar: null, time_zone: null, default_content_language: 'fr' })).toMatchObject({ numerals: 'western', calendar: 'gregorian_hijri', timeZone: 'UTC', contentLanguage: 'ar' })
  })
})

describe('Security', () => {
  it('changes the password after checking it here first, and says the other sessions stay', async () => {
    const { calls } = mockAccount()
    open('security')
    await userEvent.type(await screen.findByLabelText(/^Current password/), 'old password')
    await userEvent.type(screen.getAllByLabelText(/^New password/)[0]!, 'short')
    await userEvent.type(screen.getAllByLabelText(/^New password/)[1]!, 'other')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument()
    expect(screen.getByText('Type the same password twice.')).toBeInTheDocument()
    expect(calls.password).toHaveLength(0)
    await userEvent.clear(screen.getAllByLabelText(/^New password/)[0]!)
    await userEvent.clear(screen.getAllByLabelText(/^New password/)[1]!)
    await userEvent.type(screen.getAllByLabelText(/^New password/)[0]!, 'a better password')
    await userEvent.type(screen.getAllByLabelText(/^New password/)[1]!, 'a better password')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    await waitFor(() => expect(calls.password).toEqual([{ current_password: 'old password', password: 'a better password', password_confirmation: 'a better password' }]))
    expect(await screen.findByText('Your password was changed.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Current password/)).toHaveValue('')
    expect(screen.getByText(/Other sessions stay signed in/)).toBeInTheDocument()
  })

  it('shows the server’s reason when the current password is wrong', async () => {
    mockAccount({ password: () => fail(422, 'VALIDATION_ERROR', 'The provided current password is incorrect.', { current_password: ['The provided current password is incorrect.'] }) })
    open('security')
    await userEvent.type(await screen.findByLabelText(/^Current password/), 'wrong')
    await userEvent.type(screen.getAllByLabelText(/^New password/)[0]!, 'a better password')
    await userEvent.type(screen.getAllByLabelText(/^New password/)[1]!, 'a better password')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("The password wasn't changed")
  })

  it('turns on two-step sign-in: key, first code, then recovery codes that must be kept before it closes', async () => {
    const { calls } = mockAccount()
    open('security')
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on' }))
    expect(await screen.findByLabelText('Authenticator key')).toHaveTextContent('ABCD EFGH IJKL MNOP')
    const confirm = screen.getByRole('button', { name: 'Confirm and turn on' })
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/Code from the app/), '12ab3456')
    expect(screen.getByLabelText(/Code from the app/)).toHaveValue('123456')
    await userEvent.click(confirm)
    await waitFor(() => expect(calls.confirmed).toEqual([{ code: '123456' }]))
    const codes = await screen.findByRole('list', { name: 'Your recovery codes' })
    expect(within(codes).getAllByRole('listitem').map((l) => l.textContent)).toEqual(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC', 'DDDDDDDDDD', 'EEEEEEEEEE'])
    expect(screen.getByText(/can't be shown again/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'I have kept these codes' }))
    expect(screen.queryByRole('list', { name: 'Your recovery codes' })).not.toBeInTheDocument()
    expect(await screen.findByText(/^On\. Signing in asks for a code/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn off…' })).toBeInTheDocument()
  })

  it('says a wrong first code did not turn it on, and lets the person try again', async () => {
    mockAccount({ mfa: { confirm: () => fail(422, 'VALIDATION_ERROR', 'The provided six-digit verification code is invalid.') } })
    open('security')
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on' }))
    await userEvent.type(await screen.findByLabelText(/Code from the app/), '000000')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm and turn on' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Two-step sign-in wasn't turned on")
    expect(screen.getByLabelText(/Code from the app/)).toHaveValue('000000')
  })

  it('turns it off with the password, and starts from a new key if turned on again', async () => {
    const { calls } = mockAccount({ me: { mfa_enabled: true } })
    open('security')
    await userEvent.click(await screen.findByRole('button', { name: 'Turn off…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Turn off two-step sign-in?' })
    expect(within(dialog).getByRole('button', { name: 'Turn off' })).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText('Password'), 'my password')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn off' }))
    await waitFor(() => expect(calls.disabled).toEqual([{ password: 'my password' }]))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('button', { name: 'Turn on' })).toBeInTheDocument()
  })

  it('says it was not turned off when the password is wrong', async () => {
    mockAccount({ me: { mfa_enabled: true }, mfa: { disable: () => fail(422, 'VALIDATION_ERROR', 'Invalid credentials.') } })
    open('security')
    await userEvent.click(await screen.findByRole('button', { name: 'Turn off…' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Password'), 'nope')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn off' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Two-step sign-in wasn't turned off")
  })

  it('lists the sessions with this one marked, and ends another', async () => {
    const { calls } = mockAccount()
    open('security')
    const region = await screen.findByRole('region', { name: /Active sessions/ })
    expect(await within(region).findByText('This session')).toBeInTheDocument()
    expect(within(region).getAllByRole('listitem')).toHaveLength(2)
    expect(within(region).getAllByRole('button', { name: /^Sign out(?! all)/ })).toHaveLength(1)
    await userEvent.click(within(region).getByRole('button', { name: /^Sign out(?! all)/ }))
    await waitFor(() => expect(calls.revoked).toEqual(['2']))
    await waitFor(() => expect(within(region).getAllByRole('listitem')).toHaveLength(1))
    expect(within(region).queryByRole('button', { name: 'Sign out all other sessions' })).not.toBeInTheDocument()
  })

  it('ends all other sessions after confirmation, and keeps this one', async () => {
    const { calls } = mockAccount()
    open('security')
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out all other sessions' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('1 other session is signed out. This one stays.')).toBeInTheDocument()
    expect(calls.revokedOthers).toBe(0)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign out the others' }))
    await waitFor(() => expect(calls.revokedOthers).toBe(1))
    expect(await screen.findByText('This session')).toBeInTheDocument()
  })
})

describe('Support access', () => {
  it('says plainly that it is not available yet, and why', async () => {
    mockAccount()
    open('support')
    expect(await screen.findByText(/Not available yet: the server can't record a grant today/)).toBeInTheDocument()
    expect(screen.getByText(/Administrators can't see your private research/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Grant/ })).not.toBeInTheDocument()
  })
})

describe('Notifications', () => {
  it('shows each notice with its state and marks the ones that wait for a later release', async () => {
    mockAccount({ notifications: { notify_exports: false } })
    open('notifications')
    expect(await screen.findByRole('checkbox', { name: 'A download is ready or has failed' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'A saved search finished or was partial' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Mentions/ }).closest('label')).toHaveTextContent('R1b')
    expect(screen.getByRole('checkbox', { name: 'A corpus correction was decided' }).closest('label')).not.toHaveTextContent('R1b')
  })

  it('sends only what changed', async () => {
    const { calls } = mockAccount()
    open('notifications')
    await userEvent.click(await screen.findByRole('checkbox', { name: 'A download is ready or has failed' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /^How often/ }), 'daily')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(calls.notify).toEqual([{ notify_exports: false, email_digest: 'daily' }]))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'A download is ready or has failed' })).not.toBeChecked()
  })

  it('says a change the server did not keep was not saved', async () => {
    mockAccount({ notify: () => ok({ notify_exports: true, email_digest: 'instant' }) })
    open('notifications')
    await userEvent.click(await screen.findByRole('checkbox', { name: 'A download is ready or has failed' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("The changes weren't saved")
  })
})

describe('Account and closure', () => {
  it('shows the account number, email and state, and how many projects it owns', async () => {
    mockAccount()
    open('account')
    expect(await screen.findByText('ACC-0142')).toBeInTheDocument()
    expect(screen.getByText('shilan@example.org')).toBeInTheDocument()
    expect(screen.getByText('Active researcher')).toBeInTheDocument()
    expect(screen.getByText('You own 4 active projects.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download all research first' })).toHaveAttribute('href', '/downloads')
  })

  it('asks for the password to request closure, and sends the reason with it', async () => {
    const { calls } = mockAccount()
    open('account')
    await userEvent.click(await screen.findByRole('button', { name: 'Request closure…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Request account closure' })
    const confirm = within(dialog).getByRole('button', { name: 'Request closure' })
    expect(confirm).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Leaving research')
    await userEvent.type(within(dialog).getByLabelText(/Password/), 'my password')
    await userEvent.click(confirm)
    await waitFor(() => expect(calls.closed).toEqual([{ password: 'my password', reason: 'Leaving research' }]))
  })

  it('says the closure was not requested when the password is wrong', async () => {
    mockAccount({ close: () => fail(422, 'VALIDATION_ERROR', 'The provided password is incorrect.') })
    open('account')
    await userEvent.click(await screen.findByRole('button', { name: 'Request closure…' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/Password/), 'nope')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Request closure' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("The closure wasn't requested")
  })

  it('puts an account with a closure request on the status page, which says so', async () => {
    mockAccount({ me: { status: 'closure_requested' } })
    server.use(http.get('*/api/v1/applications/my-status', () => ok({ user_status: 'closure_requested', application: null })))
    const { router } = open()
    await waitFor(() => expect(router.state.location.pathname).toBe('/status'))
    expect(await screen.findByRole('heading', { name: 'Your account closure request is with administrators' })).toBeInTheDocument()
  })
})
