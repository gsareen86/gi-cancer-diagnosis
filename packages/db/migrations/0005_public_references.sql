-- Additive: identity allocation also backfills existing rows. UUID keys and links are unchanged.
ALTER TABLE users ADD COLUMN public_number integer GENERATED ALWAYS AS IDENTITY (START WITH 100001);
--> statement-breakpoint
CREATE UNIQUE INDEX users_public_number_key ON users (public_number);
--> statement-breakpoint
ALTER TABLE cases ADD COLUMN public_number integer GENERATED ALWAYS AS IDENTITY (START WITH 100001);
--> statement-breakpoint
CREATE UNIQUE INDEX cases_public_number_key ON cases (public_number);
--> statement-breakpoint
CREATE FUNCTION preserve_public_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.public_number IS DISTINCT FROM OLD.public_number THEN
    RAISE EXCEPTION 'public reference is immutable';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_public_reference_immutable BEFORE UPDATE OF public_number ON users
FOR EACH ROW EXECUTE FUNCTION preserve_public_reference();
--> statement-breakpoint
CREATE TRIGGER cases_public_reference_immutable BEFORE UPDATE OF public_number ON cases
FOR EACH ROW EXECUTE FUNCTION preserve_public_reference();
