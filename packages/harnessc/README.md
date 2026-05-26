# harnessc

Short npm alias for the Harness config CLI.

The canonical implementation package is `@harnessconfig/cli`. This package
exists so npm one-off execution can use the shorter command:

```bash
npx harnessc@alpha validate
npx harnessc@alpha init
npx harnessc@alpha activate
```

Once the package is promoted from alpha to latest, the command becomes:

```bash
npx harnessc validate
```

Installed usage is the same binary:

```bash
harnessc validate
harnessc activate
```
