<?php

namespace Tests\Feature;

use Tests\TestCase;

class DocsApiTest extends TestCase
{
    public function test_interactive_docs_page_is_accessible(): void
    {
        $response = $this->get('/docs');

        $response->assertStatus(200);
        $response->assertSee('Open Hadith Research Platform');
        $response->assertSee('Scalar UI');
        $response->assertSee('Swagger UI');
        $response->assertSee('api-reference');
    }

    public function test_openapi_json_specification_endpoint(): void
    {
        $response = $this->get('/docs/openapi.json');

        $response->assertStatus(200)
            ->assertJson([
                'openapi' => '3.1.0',
                'info' => [
                    'title' => 'Open Hadith Research Platform API',
                ],
            ]);

        $json = $response->json();
        $this->assertArrayHasKey('paths', $json);
        $this->assertArrayHasKey('components', $json);
        $this->assertArrayHasKey('tags', $json);

        // Verify key routes exist in spec
        $this->assertArrayHasKey('/auth/login', $json['paths']);
        $this->assertArrayHasKey('/corpus/search', $json['paths']);
        $this->assertArrayHasKey('/projects', $json['paths']);
        $this->assertArrayHasKey('/projects/{projectId}/analyses/matn-compare', $json['paths']);
        $this->assertArrayHasKey('/projects/{projectId}/analyses/isnad-compare', $json['paths']);
        $this->assertArrayHasKey('/editor/submissions', $json['paths']);
        $this->assertArrayHasKey('/public/research', $json['paths']);
    }

    public function test_postman_collection_download(): void
    {
        $response = $this->get('/docs/postman');

        $response->assertStatus(200);
        $this->assertEquals('application/json', $response->headers->get('content-type'));
    }
}
