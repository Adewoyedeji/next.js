/* eslint-env jest */
import { createNextDescribe, FileRef } from 'e2e-utils'
import cheerio from 'cheerio'
import path from 'path'

createNextDescribe(
  'app-dir with middleware',
  {
    files: path.join(__dirname, 'app-middleware'),
    skipDeployment: true,
  },
  ({ next }) => {
    describe.each([
      {
        title: 'Serverless Functions',
        path: '/api/dump-headers-serverless',
        toJson: (res: Response) => res.json(),
      },
      {
        title: 'Edge Functions',
        path: '/api/dump-headers-edge',
        toJson: (res: Response) => res.json(),
      },
      {
        title: 'next/headers',
        path: '/headers',
        toJson: async (res: Response) => {
          const $ = cheerio.load(await res.text())
          return JSON.parse($('#headers').text())
        },
      },
    ])('Mutate request headers for $title', ({ path, toJson }) => {
      it(`Adds new headers`, async () => {
        const res = await next.fetch(path, null, {
          headers: {
            'x-from-client': 'hello-from-client',
          },
        })
        expect(await toJson(res)).toMatchObject({
          'x-from-client': 'hello-from-client',
          'x-from-middleware': 'hello-from-middleware',
        })
      })

      it(`Deletes headers`, async () => {
        const res = await next.fetch(
          path,
          {
            'remove-headers': 'x-from-client1,x-from-client2',
          },
          {
            headers: {
              'x-from-client1': 'hello-from-client',
              'X-From-Client2': 'hello-from-client',
            },
          }
        )

        const json = await toJson(res)
        expect(json).not.toHaveProperty('x-from-client1')
        expect(json).not.toHaveProperty('X-From-Client2')
        expect(json).toMatchObject({
          'x-from-middleware': 'hello-from-middleware',
        })

        // Should not be included in response headers.
        expect(res.headers.get('x-middleware-override-headers')).toBeNull()
        expect(
          res.headers.get('x-middleware-request-x-from-middleware')
        ).toBeNull()
        expect(
          res.headers.get('x-middleware-request-x-from-client1')
        ).toBeNull()
        expect(
          res.headers.get('x-middleware-request-x-from-client2')
        ).toBeNull()
      })

      it(`Updates headers`, async () => {
        const res = await next.fetch(
          path,
          {
            'update-headers':
              'x-from-client1=new-value1,x-from-client2=new-value2',
          },
          {
            headers: {
              'x-from-client1': 'old-value1',
              'X-From-Client2': 'old-value2',
              'x-from-client3': 'old-value3',
            },
          }
        )
        expect(await toJson(res)).toMatchObject({
          'x-from-client1': 'new-value1',
          'x-from-client2': 'new-value2',
          'x-from-client3': 'old-value3',
          'x-from-middleware': 'hello-from-middleware',
        })

        // Should not be included in response headers.
        expect(res.headers.get('x-middleware-override-headers')).toBeNull()
        expect(
          res.headers.get('x-middleware-request-x-from-middleware')
        ).toBeNull()
        expect(
          res.headers.get('x-middleware-request-x-from-client1')
        ).toBeNull()
        expect(
          res.headers.get('x-middleware-request-x-from-client2')
        ).toBeNull()
        expect(
          res.headers.get('x-middleware-request-x-from-client3')
        ).toBeNull()
      })
    })
  }
)

createNextDescribe(
  'app dir middleware without pages dir',
  {
    files: {
      app: new FileRef(path.join(__dirname, 'app-middleware/app')),
      'next.config.js': new FileRef(
        path.join(__dirname, 'app-middleware/next.config.js')
      ),
      'middleware.js': `
      import { NextResponse } from 'next/server'

      export async function middleware(request) {
        return new NextResponse('redirected')
      }

      export const config = {
        matcher: '/headers'
      }
    `,
    },
    skipDeployment: true,
  },
  ({ next }) => {
    // eslint-disable-next-line jest/no-identical-title
    it('Updates headers', async () => {
      const html = await next.render('/headers')

      expect(html).toContain('redirected')
    })
  }
)
