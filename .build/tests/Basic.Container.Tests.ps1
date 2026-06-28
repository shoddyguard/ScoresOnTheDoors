#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }
<#
.SYNOPSIS
    Basic container health tests for ScoresOnTheDoors.
#>

Describe 'ScoresOnTheDoors container' {
    BeforeAll {
        $script:ContainerName = 'ScoresOnTheDoors-pester-' + (Get-Random -Maximum 99999)
        & docker run -d --name $script:ContainerName "$($Global:BrownserveRepoDockerImageName):latest" | Out-Null
        $script:DockerRunExitCode = $LASTEXITCODE
        Start-Sleep -Seconds 5
    }
    AfterAll {
        & docker stop $script:ContainerName 2>&1 | Out-Null
        & docker rm $script:ContainerName 2>&1 | Out-Null
    }
    It 'Container starts without error' {
        $script:DockerRunExitCode | Should -Be 0
    }
    It 'Container is still running after startup' {
        $State = & docker inspect --format '{{.State.Status}}' $script:ContainerName
        $State.Trim() | Should -Be 'running'
    }
    It 'Container is not in a restart loop' {
        $Restarting = & docker inspect --format '{{.State.Restarting}}' $script:ContainerName
        $Restarting.Trim() | Should -Be 'false'
    }
}
