-- Who did what, newest last.
select id, actor_email, action, request_id, detail from public.activity_log order by id;
