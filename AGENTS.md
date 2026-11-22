# Architecture rules

- Student and parent auth tabs use the `view` URL query parameter (`signup` explicitly, otherwise `signin`); acquisition CTAs link to signup while existing login links retain sign-in defaults, so reload and browser history preserve intent.