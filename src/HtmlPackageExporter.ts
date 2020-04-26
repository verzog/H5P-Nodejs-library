import express from 'express';
import supertest from 'supertest';

import PackageExporter from './PackageExporter';
import H5PPlayer from './H5PPlayer';
import {
    ILibraryStorage,
    IContentStorage,
    IH5PConfig,
    ContentId,
    IUser
} from './types';

import Logger from './helpers/Logger';
const log = new Logger('HtmlPackageExporter');

export default class HtmlPackageExporter extends PackageExporter {
    constructor(
        libraryStorage: ILibraryStorage,
        contentStorage: IContentStorage,
        private config: IH5PConfig,
        app: express
    ) {
        super(libraryStorage, contentStorage);
        this.superTest = supertest(app);
    }

    private superTest: supertest.SuperTest<supertest.Test>;

    public async exportToHtml(
        contentId: ContentId,
        user: IUser
    ): Promise<string> {
        log.info(`creating package for ${contentId}`);
        await this.checkAccess(contentId, user);

        const player = new H5PPlayer(
            this.libraryStorage,
            this.contentStorage,
            this.config
        );
        player.setRenderer(
            async (model) =>
                `<!doctype html>
                <html class="h5p-iframe">
                <head>
                <meta charset="utf-8">                    
                <script>H5PIntegration = ${JSON.stringify({
                    ...model.integration,
                    baseUrl: '.',
                    url: '.',
                    ajax: { setFinished: '', contentUserData: '' },
                    saveFreq: false,
                    libraryUrl: ''
                })};
                </script>                
                ${(
                    await Promise.all(
                        model.scripts.map(
                            async (script) =>
                                `<script>
                                ${(
                                    await this.superTest.get(script)
                                ).text.replace(/<\/script>/g, '<\\/script>')}
                                </script>`
                        )
                    )
                ).join('\n')}
                <style>
                    ${(
                        await Promise.all(
                            model.styles.map(
                                async (style) =>
                                    (await this.superTest.get(style)).text
                            )
                        )
                    ).join('\n')}
                </style>
                </head>
                <body>
                    <div class="h5p-content lag" data-content-id="${
                        model.contentId
                    }"></div>                
                </body>
                </html>`
        );

        return player.render(contentId);
    }
}
