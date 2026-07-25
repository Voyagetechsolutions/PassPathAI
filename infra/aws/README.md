# PassPath AWS content setup

PassPath uses two types of storage:

- **Amazon S3** stores large source files: CAPS documents, question papers,
  marking guidelines and other PDFs.
- **PostgreSQL with pgvector** stores users, subject/paper metadata, and compact
  searchable chunks used by the tutor.

The production stack runs PostgreSQL on AWS Lightsail, removing Neon's 512 MB
limit. S3 keeps the growing PDF library off the instance disk.

## 1. Create the private S3 bucket

Use the same region as the backend. The current Lightsail plan uses `eu-west-2`
(London), so these commands avoid cross-region file traffic.

If the AWS CLI is installed:

```powershell
aws cloudformation deploy `
  --region eu-west-2 `
  --stack-name passpath-content-production `
  --template-file infra/aws/content-storage.yaml `
  --capabilities CAPABILITY_NAMED_IAM

aws cloudformation describe-stacks `
  --region eu-west-2 `
  --stack-name passpath-content-production `
  --query "Stacks[0].Outputs"
```

The AWS CLI is not currently installed on the development computer. You can
instead use AWS Console -> CloudFormation -> Create stack -> Upload a template
file, select `infra/aws/content-storage.yaml`, and create the stack. Copy the
three values from the stack's **Outputs** tab.

The template creates a private bucket with all public access blocked, AES-256
encryption, versioning, TLS-only access and incomplete-upload cleanup. It also
creates a least-privilege IAM policy.

## 2. Give the API access

Create one dedicated IAM user and attach the `ContentAccessPolicyArn` output.
Create an access key for that user. Never use the AWS root account and never
commit the key to this repository.

Set these variables in the root `.env` on the Lightsail instance:

```text
STORAGE_DRIVER=s3
AWS_REGION=eu-west-2
AWS_S3_BUCKET=<BucketName output>
AWS_ACCESS_KEY_ID=<dedicated IAM user key>
AWS_SECRET_ACCESS_KEY=<dedicated IAM user secret>
AWS_S3_ENDPOINT=
```

If the API later moves to an AWS compute service that supports instance roles,
attach the same policy to its role and remove both access-key variables.

## 3. Upload the existing curriculum and papers

The local content currently lives under `apps/backend/storage`. From the
repository root:

```powershell
cd apps/backend
$env:AWS_REGION="eu-west-2"
$env:AWS_S3_BUCKET="<BucketName output>"
$env:AWS_ACCESS_KEY_ID="<temporary local operator key>"
$env:AWS_SECRET_ACCESS_KEY="<temporary local operator secret>"
$env:S3_UPLOAD_DRY_RUN="1"
$env:S3_UPLOAD_ALL="1"
npm run db:upload:s3

Remove-Item Env:S3_UPLOAD_DRY_RUN
npm run db:upload:s3
Remove-Item Env:S3_UPLOAD_ALL
npm run db:audit:content
```

The synchroniser is resumable: files already in S3 with the correct byte size
are skipped. It exits with code 2 if database records point at missing local
files, so an incomplete upload cannot look successful.

## 4. Add more subjects and papers

For new CAPS source documents:

1. Put the official PDFs in the configured CAPS folders.
2. Run `npm run db:ingest:caps`.
3. Run `npm run db:upload:s3`.
4. Run `npm run db:audit:content`.

For individual papers, use the admin past-paper upload endpoint. With
`STORAGE_DRIVER=s3`, the API writes the file directly to S3 and stores only its
metadata in PostgreSQL.

For a new local Grade 12 batch:

```powershell
$env:PAPERS_RUN="1"
npm run db:ingest:local-papers
npm run db:upload:s3
npm run db:audit:content
```

If an older ingestion created AI document records but no learner-facing paper
catalogue rows, run the catalogue backfill:

```powershell
npm run db:catalog:papers
$env:PAPER_CATALOG_RUN="1"
npm run db:catalog:papers
Remove-Item Env:PAPER_CATALOG_RUN
```

Do not delete the local copy until the S3 sync and audit both pass.

## 5. Database capacity

S3 does not replace searchable PostgreSQL chunks. The production stack in
`docker-compose.prod.yml` runs PostgreSQL with pgvector on the Lightsail disk.
Follow `DEPLOY.md` to copy Neon with `pg_dump`/`pg_restore`, then run
`npm run db:audit:content`.

Amazon RDS is an optional later upgrade if you want a managed database with
built-in high availability. It is not provisioned here because it adds a
separate recurring charge.
